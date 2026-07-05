-- 0019_stock_enforcement.sql — TASKS 4.4 (Phase 4 production-readiness audit)
--
-- place_order never checked or decremented product.stock — nothing prevented
-- ordering an out-of-stock item, and the admin's low-stock alerts tracked a
-- number nothing enforced (STOREFRONT_SHORTFALLS.md 1.2). This migration:
--
--   1. place_order: locks each product row FOR UPDATE (serializes concurrent
--      orders against the same product so two shoppers can't both "win" the
--      last unit), rejects the line with OUT_OF_STOCK: {name} if the
--      requested qty exceeds available stock, and decrements stock by qty in
--      the same transaction as the order write.
--   2. admin_set_order_status: restores stock on Cancel (mirrors the 3.6b
--      coupon-use release) so a cancelled COD order doesn't leave stock
--      permanently short.
--
-- INCIDENTAL FIX (found while rewriting this function): the auth.uid() gate
-- and `user_id` stamping that 0004_customer_auth.sql added to place_order were
-- silently dropped when 0012_admin_coupons.sql re-created the function for the
-- coupon-table rewrite, and the gap carried through 0013/0018 unnoticed —
-- confirmed live: the 3 most recent production orders have user_id = null.
-- `execute` was never re-granted to anon (0004's revoke still stands), so this
-- was never an anonymous-write hole, but authenticated customers' orders since
-- 0012 haven't been tagged to their account. Restored here since this
-- migration already rewrites the same function body.
--
-- Both functions keep their existing signatures/contracts.

create or replace function public.place_order(p_items jsonb, p_customer jsonb, p_coupon text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id              uuid;
  v_flat_shipping        integer;
  v_free_ship_threshold  integer;
  v_subtotal             integer := 0;
  v_discount             integer := 0;
  v_shipping             integer := 0;
  v_total                integer;
  v_order_id             uuid;
  v_order_no             text;
  v_suffix               text;
  v_payment_method       text;
  v_coupon               text;
  v_coupon_dropped       boolean := false;
  v_free_shipping        boolean := false;
  v_c_kind               text;
  v_c_value              integer;
  v_c_max                integer;
  v_item                 jsonb;
  v_qty                  integer;
  v_line_total           integer;
  v_product              record;
begin
  -- Checkout is sign-in-only: SECURITY DEFINER bypasses RLS, so the auth gate
  -- must live here, on the only write path.
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'check_violation';
  end if;

  v_payment_method := coalesce(p_customer->>'payment_method', 'cod');
  if v_payment_method <> 'cod' then
    raise exception 'UNSUPPORTED_PAYMENT_METHOD' using errcode = 'check_violation';
  end if;

  -- Shipping config is store-managed (Settings, 3.11): free-ship threshold + flat fee.
  select coalesce(free_ship_threshold_paise, 99900), coalesce(flat_rate_paise, 7900)
    into v_free_ship_threshold, v_flat_shipping
    from setting limit 1;
  v_free_ship_threshold := coalesce(v_free_ship_threshold, 99900);
  v_flat_shipping       := coalesce(v_flat_shipping, 7900);

  v_suffix := (
    select string_agg(
      substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 1 + floor(random() * 36)::int, 1),
      ''
    )
    from generate_series(1, 4)
  );
  v_order_no := 'JR-'
    || to_char((now() at time zone 'Asia/Kolkata'), 'YYMMDD')
    || '-' || lpad(nextval('order_no_seq')::text, 4, '0')
    || '-' || v_suffix;

  insert into "order" (
    order_no, status, payment_method, payment_status,
    customer_name, customer_phone, customer_email,
    address_line, city, state, pincode,
    subtotal_paise, discount_paise, shipping_paise, total_paise, coupon_code,
    user_id
  ) values (
    v_order_no, 'Pending', 'cod', 'pending',
    p_customer->>'full_name', p_customer->>'phone', p_customer->>'email',
    p_customer->>'address_line', p_customer->>'city', p_customer->>'state', p_customer->>'pincode',
    0, 0, 0, 0, null,
    v_user_id
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) as value loop
    v_qty := floor(coalesce((v_item->>'qty')::numeric, 1))::integer;
    if v_qty < 1 then v_qty := 1; end if;
    if v_qty > 10 then v_qty := 10; end if;

    -- Lock the row so two concurrent orders can't both oversell the last unit.
    select id, name, price_paise, status, stock into v_product
      from product where id = (v_item->>'product_id')::uuid
      for update;
    if not found then
      raise exception 'PRODUCT_NOT_FOUND: %', v_item->>'product_id' using errcode = 'no_data_found';
    end if;
    if v_product.status = 'Draft' then
      raise exception 'PRODUCT_UNAVAILABLE: %', v_product.name using errcode = 'check_violation';
    end if;
    if v_product.stock < v_qty then
      raise exception 'OUT_OF_STOCK: %', v_product.name using errcode = 'check_violation';
    end if;

    update product set stock = stock - v_qty where id = v_product.id;

    v_line_total := v_product.price_paise * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    insert into order_item (order_id, product_id, name, tone, qty, unit_price_paise, line_total_paise)
    values (v_order_id, v_product.id, v_product.name, nullif(v_item->>'tone', ''), v_qty, v_product.price_paise, v_line_total);
  end loop;

  v_coupon := nullif(upper(btrim(coalesce(p_coupon, ''))), '');
  if v_coupon is not null then
    update coupon
       set usage_count = usage_count + 1
     where code = v_coupon
       and is_active
       and (expires_at is null or expires_at > now())
       and (usage_limit is null or usage_count < usage_limit)
       and (min_subtotal_paise is null or v_subtotal >= min_subtotal_paise)
    returning kind, value, max_discount_paise into v_c_kind, v_c_value, v_c_max;

    if found then
      if v_c_kind = 'percent' then
        v_discount := round(v_subtotal * v_c_value / 100.0);
      elsif v_c_kind = 'fixed' then
        v_discount := v_c_value;
      elsif v_c_kind = 'free_shipping' then
        v_discount := 0;
        v_free_shipping := true;
      end if;
      if v_c_max is not null then
        v_discount := least(v_discount, v_c_max);
      end if;
      v_discount := greatest(0, least(v_discount, v_subtotal));
    else
      v_coupon := null;
      v_coupon_dropped := true;
    end if;
  end if;

  if v_free_shipping then
    v_shipping := 0;
  elsif v_subtotal <= 0 then
    v_shipping := 0;
  elsif v_subtotal >= v_free_ship_threshold then
    v_shipping := 0;
  else
    v_shipping := v_flat_shipping;
  end if;

  v_total := v_subtotal - v_discount + v_shipping;

  update "order" set
    subtotal_paise = v_subtotal,
    discount_paise = v_discount,
    shipping_paise = v_shipping,
    total_paise    = v_total,
    coupon_code    = v_coupon
  where id = v_order_id;

  return jsonb_build_object(
    'order_no', v_order_no,
    'subtotal_paise', v_subtotal,
    'discount_paise', v_discount,
    'shipping_paise', v_shipping,
    'total_paise', v_total,
    'coupon_dropped', v_coupon_dropped
  );
end;
$function$;

-- ── admin_set_order_status: restore stock on cancel ────────────────────────────
create or replace function public.admin_set_order_status(
  p_order_id uuid,
  p_status   text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flow    text[] := array['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];
  v_current text;
  v_coupon  text;
  v_ci      int;
  v_ni      int;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  select status, coupon_code into v_current, v_coupon from "order" where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Terminal states never change.
  if v_current in ('Delivered', 'Cancelled') then
    raise exception 'ORDER_TERMINAL: %', v_current using errcode = 'check_violation';
  end if;

  -- Cancel is reachable from any non-terminal state. Release the coupon use and
  -- restore stock so a cancelled COD order doesn't permanently burn a limited
  -- code or leave stock short (cancel is terminal, so this runs at most once).
  if p_status = 'Cancelled' then
    update "order" set status = 'Cancelled' where id = p_order_id;
    if v_coupon is not null then
      update coupon set usage_count = greatest(0, usage_count - 1) where code = v_coupon;
    end if;
    update product p
       set stock = p.stock + oi.qty
      from order_item oi
     where oi.order_id = p_order_id
       and p.id = oi.product_id;
    return 'Cancelled';
  end if;

  -- Otherwise only a single forward step is allowed.
  v_ci := array_position(v_flow, v_current);
  v_ni := array_position(v_flow, p_status);
  if v_ni is null or v_ni <> v_ci + 1 then
    raise exception 'INVALID_TRANSITION: % -> %', v_current, p_status
      using errcode = 'check_violation';
  end if;

  update "order" set status = p_status where id = p_order_id;
  return p_status;
end;
$$;

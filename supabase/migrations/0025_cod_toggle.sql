-- 0025_cod_toggle.sql — TASKS 5.3 (make the COD toggle real)
--
-- Settings exposes a live "Cash on Delivery" toggle (setting.cod_enabled), but
-- place_order never read it — so the switch did nothing. COD is the only tender
-- in v1, so this toggle is effectively the store's order kill-switch (pause
-- orders during a stock freeze / festival rush / holiday). Enforce it on the
-- only write path: place_order now reads cod_enabled alongside the shipping
-- config it already loads, and rejects with COD_DISABLED when off. The checkout
-- UI mirrors this (disabled Place Order + a "paused" notice), but this is the
-- authority — a direct RPC call can't bypass it.
--
-- Body is 0019's place_order verbatim plus the cod_enabled read + guard.

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
  v_cod_enabled          boolean;
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

  -- Store-managed config (Settings, 3.11 / 5.3): shipping + the COD kill-switch.
  select coalesce(free_ship_threshold_paise, 99900),
         coalesce(flat_rate_paise, 7900),
         coalesce(cod_enabled, true)
    into v_free_ship_threshold, v_flat_shipping, v_cod_enabled
    from setting limit 1;
  v_free_ship_threshold := coalesce(v_free_ship_threshold, 99900);
  v_flat_shipping       := coalesce(v_flat_shipping, 7900);
  v_cod_enabled         := coalesce(v_cod_enabled, true);

  -- COD is the only tender in v1, so a disabled toggle pauses all orders.
  if not v_cod_enabled then
    raise exception 'COD_DISABLED' using errcode = 'check_violation';
  end if;

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

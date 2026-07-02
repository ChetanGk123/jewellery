-- TASKS 2.6 — Confirmation page.
--
-- 1. `place_order` now also returns the order's `order_id` (uuid) so checkout can
--    redirect to a confirmation URL keyed on the UNGUESSABLE id — order numbers
--    are sequential and must not be enumerable.
-- 2. `get_order_confirmation(p_id)` is a read-only SECURITY DEFINER function that
--    returns just the confirmation fields for one order (the tables stay
--    RLS-sealed). The uuid acts as a bearer capability: only someone with the
--    checkout redirect link can read it. Returns null when the id is unknown.

create or replace function place_order(
  p_items    jsonb,
  p_customer jsonb,
  p_coupon   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flat_shipping        integer := 7900;
  v_free_ship_threshold  integer;
  v_subtotal             integer := 0;
  v_discount             integer := 0;
  v_shipping             integer := 0;
  v_total                integer;
  v_order_id             uuid;
  v_order_no             text;
  v_payment_method       text;
  v_coupon               text;
  v_item                 jsonb;
  v_qty                  integer;
  v_line_total           integer;
  v_product              record;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'check_violation';
  end if;

  v_payment_method := coalesce(p_customer->>'payment_method', 'cod');
  if v_payment_method <> 'cod' then
    raise exception 'UNSUPPORTED_PAYMENT_METHOD' using errcode = 'check_violation';
  end if;

  select coalesce(free_ship_threshold_paise, 99900) into v_free_ship_threshold from setting limit 1;
  v_free_ship_threshold := coalesce(v_free_ship_threshold, 99900);

  v_order_no := 'JR-'
    || to_char((now() at time zone 'Asia/Kolkata'), 'YYMMDD')
    || '-' || lpad(nextval('order_no_seq')::text, 4, '0');

  insert into "order" (
    order_no, status, payment_method, payment_status,
    customer_name, customer_phone, customer_email,
    address_line, city, state, pincode,
    subtotal_paise, discount_paise, shipping_paise, total_paise, coupon_code
  ) values (
    v_order_no, 'Pending', 'cod', 'pending',
    p_customer->>'full_name', p_customer->>'phone', p_customer->>'email',
    p_customer->>'address_line', p_customer->>'city', p_customer->>'state', p_customer->>'pincode',
    0, 0, 0, 0, null
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) as value loop
    v_qty := floor(coalesce((v_item->>'qty')::numeric, 1))::integer;
    if v_qty < 1 then v_qty := 1; end if;
    if v_qty > 10 then v_qty := 10; end if;

    select id, name, price_paise, status into v_product
      from product where id = (v_item->>'product_id')::uuid;
    if not found then
      raise exception 'PRODUCT_NOT_FOUND: %', v_item->>'product_id' using errcode = 'no_data_found';
    end if;
    if v_product.status = 'Draft' then
      raise exception 'PRODUCT_UNAVAILABLE: %', v_product.name using errcode = 'check_violation';
    end if;

    v_line_total := v_product.price_paise * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    insert into order_item (order_id, product_id, name, tone, qty, unit_price_paise, line_total_paise)
    values (v_order_id, v_product.id, v_product.name, nullif(v_item->>'tone', ''), v_qty, v_product.price_paise, v_line_total);
  end loop;

  v_coupon := nullif(upper(btrim(coalesce(p_coupon, ''))), '');
  if v_coupon = 'BRIDE20' then
    v_discount := round(v_subtotal * 20 / 100.0);
    v_discount := greatest(0, least(v_discount, v_subtotal));
  else
    v_coupon := null;
    v_discount := 0;
  end if;

  if v_subtotal <= 0 then
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
    'order_id', v_order_id,
    'order_no', v_order_no,
    'subtotal_paise', v_subtotal,
    'discount_paise', v_discount,
    'shipping_paise', v_shipping,
    'total_paise', v_total
  );
end;
$$;

-- Read-only confirmation lookup by unguessable order id. No RLS policy is added;
-- this definer function is the only read path and returns just what the
-- confirmation page shows. Null when the id doesn't exist.
create or replace function get_order_confirmation(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'order_no', o.order_no,
    'status', o.status,
    'payment_method', o.payment_method,
    'customer_email', o.customer_email,
    'total_paise', o.total_paise,
    'created_at', o.created_at
  )
  from "order" o
  where o.id = p_id;
$$;

revoke all on function get_order_confirmation(uuid) from public;
grant execute on function get_order_confirmation(uuid) to anon, authenticated;

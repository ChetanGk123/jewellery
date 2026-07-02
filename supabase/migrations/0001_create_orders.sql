-- TASKS 2.5 — Order creation (COD v1).
--
-- Adds the `order` + `order_item` tables and a SECURITY DEFINER `place_order`
-- RPC that is the ONLY sanctioned write path. RLS on both tables denies all
-- direct anon/authenticated access, so the public publishable key cannot read
-- other people's orders or insert a hand-crafted one. Totals are recomputed
-- inside the function from the authoritative `product.price_paise` — the client
-- never supplies a price or total (mirrors lib/cart, lib/coupons, lib/shipping).
--
-- v1 is COD-only; the schema carries Razorpay/Shiprocket-ready columns
-- (payment_status, awb, shiprocket_shipment_id) for later phases.

-- Monotonic counter for human-readable order numbers (JR-YYMMDD-####).
create sequence if not exists order_no_seq start with 1001;

create table if not exists "order" (
  id                     uuid primary key default gen_random_uuid(),
  order_no               text not null unique,
  status                 text not null default 'Pending'
                           check (status in ('Pending','Confirmed','Packed','Shipped','Delivered','Cancelled')),
  payment_method         text not null default 'cod'
                           check (payment_method in ('cod','razorpay')),
  payment_status         text not null default 'pending'
                           check (payment_status in ('pending','paid','failed','refunded')),
  customer_name          text not null,
  customer_phone         text not null,
  customer_email         text not null,
  address_line           text not null,
  city                   text not null,
  state                  text not null,
  pincode                text not null,
  subtotal_paise         integer not null check (subtotal_paise >= 0),
  discount_paise         integer not null default 0 check (discount_paise >= 0),
  shipping_paise         integer not null default 0 check (shipping_paise >= 0),
  total_paise            integer not null check (total_paise >= 0),
  coupon_code            text,
  awb                    text,
  shiprocket_shipment_id text,
  created_at             timestamptz not null default now()
);

create table if not exists order_item (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references "order"(id) on delete cascade,
  product_id       uuid not null references product(id),
  name             text not null,
  tone             text,
  qty              integer not null check (qty >= 1 and qty <= 10),
  unit_price_paise integer not null check (unit_price_paise >= 0),
  line_total_paise integer not null check (line_total_paise >= 0)
);

create index if not exists order_item_order_id_idx on order_item(order_id);
create index if not exists order_created_at_idx on "order"(created_at desc);

-- Lock the tables down: RLS enabled with zero policies == deny all for the
-- anon/authenticated roles. Only the SECURITY DEFINER function (owned by the
-- table owner, which bypasses RLS) can touch these rows.
alter table "order" enable row level security;
alter table order_item enable row level security;

-- place_order: the authoritative, tamper-proof checkout write path.
--   p_items    jsonb array of { product_id, tone, qty }
--   p_customer jsonb { full_name, phone, email, address_line, city, state, pincode, payment_method }
--   p_coupon   optional raw coupon code
-- Returns { order_no, subtotal_paise, discount_paise, shipping_paise, total_paise }.
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
  v_flat_shipping        integer := 7900;   -- lib/shipping FLAT_SHIPPING_PAISE
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

  -- COD is the only tender in v1.
  v_payment_method := coalesce(p_customer->>'payment_method', 'cod');
  if v_payment_method <> 'cod' then
    raise exception 'UNSUPPORTED_PAYMENT_METHOD' using errcode = 'check_violation';
  end if;

  -- Store-configurable free-ship threshold (getStoreSettings default 99900).
  select coalesce(free_ship_threshold_paise, 99900) into v_free_ship_threshold from setting limit 1;
  v_free_ship_threshold := coalesce(v_free_ship_threshold, 99900);

  v_order_no := 'RJ-'
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

  -- Recompute every line from the authoritative product price.
  for v_item in select value from jsonb_array_elements(p_items) as value loop
    v_qty := floor(coalesce((v_item->>'qty')::numeric, 1))::integer;
    if v_qty < 1 then v_qty := 1; end if;
    if v_qty > 10 then v_qty := 10; end if;  -- lib/cart MAX_LINE_QUANTITY

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

  -- Coupon discount (mirrors lib/coupons: BRIDE20 = 20% off, no min/cap/expiry).
  -- Clamp to [0, subtotal]. Unknown/empty codes yield no discount and store null.
  v_coupon := nullif(upper(btrim(coalesce(p_coupon, ''))), '');
  if v_coupon = 'BRIDE20' then
    v_discount := round(v_subtotal * 20 / 100.0);
    v_discount := greatest(0, least(v_discount, v_subtotal));
  else
    v_coupon := null;
    v_discount := 0;
  end if;

  -- Shipping is computed on the pre-discount subtotal (mirrors CheckoutView).
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
    'order_no', v_order_no,
    'subtotal_paise', v_subtotal,
    'discount_paise', v_discount,
    'shipping_paise', v_shipping,
    'total_paise', v_total
  );
end;
$$;

-- Only the storefront roles may call the function; the tables stay sealed.
revoke all on function place_order(jsonb, jsonb, text) from public;
grant execute on function place_order(jsonb, jsonb, text) to anon, authenticated;

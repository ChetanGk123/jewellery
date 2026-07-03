-- Storefront customer auth & authorization.
--
-- Checkout now REQUIRES a signed-in customer (product decision — no more guest
-- orders), so:
--   1. `customer_profile` — one row per auth user (name/phone/default address)
--      that prefills checkout. RLS: a user can read/write only their own row.
--   2. `"order".user_id` — orders belong to the customer who placed them. New
--      RLS SELECT policies let a customer read only their own orders/items
--      ("My Orders"); writes stay locked to the SECURITY DEFINER RPC.
--   3. `place_order` — raises for anonymous callers, stamps `user_id`, and
--      execute is revoked from `anon` (authenticated only).
-- `get_order_confirmation` is unchanged: the unguessable order-no URL still
-- works immediately after checkout without an extra RLS round-trip.

-- 1 ── customer profile ------------------------------------------------------

create table customer_profile (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null default '',
  phone        text not null default '',
  address_line text not null default '',
  city         text not null default '',
  state        text not null default '',
  pincode      text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table customer_profile enable row level security;

create policy "customer reads own profile"
  on customer_profile for select
  to authenticated
  using (id = (select auth.uid()));

create policy "customer creates own profile"
  on customer_profile for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "customer updates own profile"
  on customer_profile for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 2 ── orders belong to customers -------------------------------------------

alter table "order"
  add column user_id uuid references auth.users (id);

create index order_user_id_idx on "order" (user_id, created_at desc);

create policy "customer reads own orders"
  on "order" for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "customer reads own order items"
  on order_item for select
  to authenticated
  using (
    exists (
      select 1 from "order" o
      where o.id = order_item.order_id
        and o.user_id = (select auth.uid())
    )
  );

-- 3 ── place_order requires an authenticated customer ------------------------

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
  v_suffix               text;
  v_payment_method       text;
  v_coupon               text;
  v_item                 jsonb;
  v_qty                  integer;
  v_line_total           integer;
  v_product              record;
  v_user_id              uuid;
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

  select coalesce(free_ship_threshold_paise, 99900) into v_free_ship_threshold from setting limit 1;
  v_free_ship_threshold := coalesce(v_free_ship_threshold, 99900);

  -- 4 random base36 chars — makes the (otherwise sequential) number unguessable.
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
    'order_no', v_order_no,
    'subtotal_paise', v_subtotal,
    'discount_paise', v_discount,
    'shipping_paise', v_shipping,
    'total_paise', v_total
  );
end;
$$;

-- Authenticated customers only — the storefront's anon key can no longer write.
revoke execute on function place_order(jsonb, jsonb, text) from anon;

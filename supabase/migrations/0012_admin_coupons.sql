-- 0012_admin_coupons.sql — TASKS 3.6 Coupons
--
-- Lands the `coupon` table as the single source of truth and retires the
-- hard-coded BRIDE20 rule that lived in BOTH lib/coupons.ts and place_order
-- (a documented drift risk: an admin changing the discount would silently
-- disagree with the storefront). After this:
--   - place_order looks the code up in `coupon`, re-validates it, computes the
--     discount server-side, and increments `usage_count` ATOMICALLY (the guarded
--     UPDATE is the check-and-consume, so a race can't exceed usage_limit).
--   - the storefront preview reads active/valid coupons via a public RLS policy
--     (display-only; place_order stays the authority).
--   - admin manages codes through is_admin()-gated SECURITY DEFINER RPCs; the
--     table stays RLS-sealed for direct writes (no service-role key).

create table if not exists coupon (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  -- 'percent' → value is 0–100; 'fixed' → value is a paise amount off;
  -- 'free_shipping' → value ignored (0), the coupon zeroes shipping instead.
  kind                text not null check (kind in ('percent', 'fixed', 'free_shipping')),
  value               integer not null default 0 check (value >= 0),
  min_subtotal_paise  integer check (min_subtotal_paise is null or min_subtotal_paise >= 0),
  max_discount_paise  integer check (max_discount_paise is null or max_discount_paise >= 0),
  usage_limit         integer check (usage_limit is null or usage_limit >= 0),
  usage_count         integer not null default 0 check (usage_count >= 0),
  expires_at          timestamptz,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  -- percent coupons can't exceed 100
  constraint coupon_percent_range check (kind <> 'percent' or value <= 100)
);

-- The advertised launch code, seeded so nothing regresses when place_order
-- switches to the table (matches the previous hard-coded BRIDE20 = 20%, no
-- min/cap/expiry). Idempotent so re-running the migration is safe.
insert into coupon (code, kind, value)
values ('BRIDE20', 'percent', 20)
on conflict (code) do nothing;

alter table coupon enable row level security;

-- Storefront preview: anon/authenticated may read only coupons that are
-- currently usable (active, unexpired, under their usage cap). Secret-until-
-- expired codes are still exposed once active — acceptable for advertised promo
-- codes; place_order is the real gate. (Follow-up: a server-action single-code
-- validator if truly secret codes are ever needed.)
drop policy if exists "coupon_public_read" on coupon;
create policy "coupon_public_read" on coupon
  for select to anon, authenticated
  using (
    is_active
    and (expires_at is null or expires_at > now())
    and (usage_limit is null or usage_count < usage_limit)
  );

-- Admins read every coupon (inactive/expired/exhausted included) for the console
-- list. OR'd with the public policy, so it's purely additive.
drop policy if exists "coupon_admin_read" on coupon;
create policy "coupon_admin_read" on coupon
  for select to authenticated using (public.is_admin());

-- ── Admin write RPCs (is_admin()-gated, SECURITY DEFINER) ──────────────────────

-- Insert or update a coupon. p_id null → insert (code must be unique); non-null
-- → update that row. Code is normalised (trim/upper). usage_count is never
-- touched here (only place_order increments it).
create or replace function admin_upsert_coupon(p_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_code   text;
  v_kind   text;
  v_value  integer;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  v_code := nullif(upper(btrim(coalesce(p_payload->>'code', ''))), '');
  if v_code is null then
    raise exception 'CODE_REQUIRED' using errcode = 'check_violation';
  end if;

  v_kind := coalesce(p_payload->>'kind', 'percent');
  if v_kind not in ('percent', 'fixed', 'free_shipping') then
    raise exception 'INVALID_KIND' using errcode = 'check_violation';
  end if;

  v_value := coalesce((p_payload->>'value')::integer, 0);
  if v_value < 0 then v_value := 0; end if;
  if v_kind = 'percent' and v_value > 100 then v_value := 100; end if;
  if v_kind = 'free_shipping' then v_value := 0; end if;

  if p_id is null then
    insert into coupon (
      code, kind, value, min_subtotal_paise, max_discount_paise,
      usage_limit, expires_at, is_active
    ) values (
      v_code, v_kind, v_value,
      nullif((p_payload->>'min_subtotal_paise'), '')::integer,
      nullif((p_payload->>'max_discount_paise'), '')::integer,
      nullif((p_payload->>'usage_limit'), '')::integer,
      nullif((p_payload->>'expires_at'), '')::timestamptz,
      coalesce((p_payload->>'is_active')::boolean, true)
    )
    returning id into v_id;
  else
    update coupon set
      code               = v_code,
      kind               = v_kind,
      value              = v_value,
      min_subtotal_paise = nullif((p_payload->>'min_subtotal_paise'), '')::integer,
      max_discount_paise = nullif((p_payload->>'max_discount_paise'), '')::integer,
      usage_limit        = nullif((p_payload->>'usage_limit'), '')::integer,
      expires_at         = nullif((p_payload->>'expires_at'), '')::timestamptz,
      is_active          = coalesce((p_payload->>'is_active')::boolean, is_active)
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'COUPON_NOT_FOUND' using errcode = 'no_data_found';
    end if;
  end if;

  return v_id;
end;
$$;

-- Flip a coupon's active state (the inline list toggle).
create or replace function admin_toggle_coupon(p_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  update coupon set is_active = p_active where id = p_id;
  if not found then
    raise exception 'COUPON_NOT_FOUND' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function admin_upsert_coupon(uuid, jsonb) from public;
revoke all on function admin_toggle_coupon(uuid, boolean) from public;
grant execute on function admin_upsert_coupon(uuid, jsonb) to authenticated;
grant execute on function admin_toggle_coupon(uuid, boolean) to authenticated;

-- ── place_order: coupon is now table-driven ───────────────────────────────────
-- Same signature/return contract; the only change is the coupon block (and a
-- free-shipping path that zeroes shipping). Usage is consumed atomically.
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
  v_free_shipping        boolean := false;
  v_c_kind               text;
  v_c_value              integer;
  v_c_max                integer;
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

  -- Table-driven coupon: the guarded UPDATE atomically checks (active, unexpired,
  -- under the usage cap, meets the minimum) AND consumes one use in a single
  -- row-locked statement, so concurrent orders can never exceed usage_limit.
  -- If nothing matches, the code silently yields no discount (stored null).
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
      v_coupon := null;  -- invalid / expired / exhausted / below-minimum
    end if;
  end if;

  -- Shipping is computed on the pre-discount subtotal (mirrors CheckoutView);
  -- a free-shipping coupon zeroes it.
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
    'total_paise', v_total
  );
end;
$$;

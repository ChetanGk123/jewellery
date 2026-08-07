-- 0001_initial_schema.sql — JR Jewellers: consolidated schema (squashed from
-- the original 0000a…0044 migration history).
--
-- This single file represents the CURRENT end state of the schema — not a
-- replay of how it got there. Superseded intermediate definitions (functions
-- redefined multiple times, columns later dropped, one-off data backfills for
-- rows that existed mid-history) are omitted; only the final shape of every
-- table, function, trigger, policy, and storage rule is kept.
--
-- Money is stored as integer paise. Timestamps are timestamptz (UTC unless
-- noted). Every admin write goes through a SECURITY DEFINER RPC gated on
-- public.is_admin() (the JWT app_metadata.role claim) — tables stay RLS-sealed
-- for direct writes; there is no service-role key in the app.

create extension if not exists "pgcrypto";

-- ════════════════════════════════════════════════════════════════════════
-- Sequences
-- ════════════════════════════════════════════════════════════════════════

-- Monotonic counter for human-readable order numbers (JR-YYMMDD-####-XXXX).
create sequence if not exists order_no_seq start with 1001;

-- Global ticket counter (TK-YYMMDD-###; grows past 3 digits fine).
create sequence if not exists contact_message_no_seq start with 1;

-- ════════════════════════════════════════════════════════════════════════
-- Tables
-- ════════════════════════════════════════════════════════════════════════

-- ---------- categories ----------
create table public.category (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  hero_bg     text,                       -- css gradient/color placeholder until real imagery
  image_url   text,                       -- real photo; falls back to hero_bg when unset
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- products ----------
create table public.product (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  sku               text not null unique,
  name              text not null,
  category_id       uuid not null references public.category(id) on delete restrict,
  material          text,
  badge             text not null default 'None'
                      check (badge in ('None','Bestseller','New','Bridal Edit')),
  price_paise       int  not null check (price_paise >= 0),
  mrp_paise         int  check (mrp_paise is null or mrp_paise >= price_paise),
  stock             int  not null default 0,
  status            text not null default 'Active'
                      check (status in ('Active','Low stock','Out of stock','Draft')),
  blurb             text,                    -- short description (card + product hero)
  desc_long         text,
  details_plating   text,
  details_stones    text,
  details_care      text,
  shipping_note     text,
  rating            numeric(2,1) not null default 0,
  review_count      int  not null default 0,
  is_featured       boolean not null default false,  -- "Bestselling" rail on home
  is_fresh          boolean not null default false,  -- "New Arrivals" rail on home
  primary_image_url text,                    -- denormalised for join-free listing reads
  gallery           jsonb not null default '[]'::jsonb,   -- ordered [{url, name, primary}]
  plating_options   text[] not null default '{}',         -- finishes (Gold tone, etc.)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  search            tsvector generated always as (
                      to_tsvector('simple'::regconfig,
                        coalesce(name,'') || ' ' || coalesce(blurb,'') || ' ' || coalesce(material,''))
                    ) stored
);
create index product_category_idx  on public.product(category_id);
create index product_status_idx    on public.product(status);
create index product_search_idx    on public.product using gin (search);
create index product_active_by_cat on public.product (category_id, created_at desc) where status = 'Active';
create index product_featured_idx  on public.product (created_at desc) where is_featured;

-- ---------- product images / designs ----------
create table public.product_image (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.product(id) on delete cascade,
  url         text,                        -- null => render placeholder
  design_name text,
  bg          text,                        -- placeholder gradient swatch
  is_primary  boolean not null default false,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);
create index product_image_product_idx on public.product_image(product_id);
create unique index product_image_one_primary on public.product_image (product_id) where is_primary;

-- ---------- plating-tone options (legacy; product.plating_options is now the
-- single source of truth the storefront reads — kept for data preservation) --
create table public.product_option (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.product(id) on delete cascade,
  label       text not null,               -- e.g. Gold, Silver, Rose
  value       text not null,
  sort_order  int not null default 0
);
create index product_option_product_idx on public.product_option(product_id);

-- ---------- reviews ----------
create table public.review (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.product(id) on delete cascade,
  user_id     uuid references auth.users (id),
  name        text not null,
  rating      int  not null check (rating between 1 and 5),
  title       text,
  body        text,
  status      text not null default 'approved'
                check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);
create index review_product_idx on public.review(product_id);
create unique index review_product_user_uniq on public.review (product_id, user_id) where user_id is not null;

-- ---------- store settings (singleton) ----------
create table public.setting (
  id                        boolean primary key default true check (id),
  store_name                text not null default 'JR Jewellers',
  support_email             text,
  phone                     text,
  gstin                     text,
  free_ship_threshold_paise int not null default 99900,
  flat_rate_paise           int not null default 7900,
  cod_enabled               boolean not null default true,
  razorpay_live             boolean not null default false,
  banner                    jsonb not null default '{}'::jsonb,
  homepage_promo            jsonb not null default '{}'::jsonb,
  homepage_hero             jsonb not null default '{}'::jsonb,   -- {image_url}
  store_info                jsonb not null default '{}'::jsonb,   -- descriptor/address/hours/socials
  email_copy                jsonb not null default '{}'::jsonb,   -- per-template overrides
  returns                   jsonb not null default '{}'::jsonb,   -- {window_days, shipping_payer}
  updated_at                timestamptz not null default now()
);

-- ---------- customer profile (prefills checkout) ----------
create table public.customer_profile (
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

-- ---------- orders (COD v1; payment_status/awb/shiprocket columns are
-- Razorpay/Shiprocket-ready for later phases) ----------
create table public."order" (
  id                     uuid primary key default gen_random_uuid(),
  order_no               text not null unique,
  status                 text not null default 'Pending'
                           check (status in ('Pending','Confirmed','Packed','Shipped','Delivered','Cancelled')),
  payment_method         text not null default 'cod'
                           check (payment_method in ('cod','razorpay')),
  payment_status         text not null default 'pending'
                           check (payment_status in ('pending','paid','failed','refunded')),
  user_id                uuid references auth.users (id),
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
  tracking_url           text,
  shiprocket_shipment_id text,
  delivered_at           timestamptz,
  created_at             timestamptz not null default now()
);
create index order_created_at_idx on public."order"(created_at desc);
create index order_user_id_idx    on public."order" (user_id, created_at desc);

create table public.order_item (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public."order"(id) on delete cascade,
  product_id       uuid not null references public.product(id),
  name             text not null,
  tone             text,
  qty              integer not null check (qty >= 1 and qty <= 10),
  unit_price_paise integer not null check (unit_price_paise >= 0),
  line_total_paise integer not null check (line_total_paise >= 0)
);
create index order_item_order_id_idx on public.order_item(order_id);

-- ---------- coupons ----------
create table public.coupon (
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
  constraint coupon_percent_range check (kind <> 'percent' or value <= 100)
);

-- ---------- contact form ticket queue ----------
create table public.contact_message (
  id              uuid primary key default gen_random_uuid(),
  ticket_no       text not null unique,
  subject         text,
  body            text not null,
  name            text not null,
  email           text not null,
  phone           text not null,
  status          text not null default 'New'
                    check (status in ('New', 'In Progress', 'Resolved')),
  resolution_note text,
  created_at      timestamptz not null default now()
);
create index contact_message_status_created_idx on public.contact_message (status, created_at desc);

-- ---------- newsletter subscribers ----------
create table public.subscriber (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text not null default 'footer'
             check (source in ('footer', 'checkout', 'popup')),
  created_at timestamptz not null default now()
);
-- Case-insensitive uniqueness: one row per address regardless of typed casing.
create unique index subscriber_email_lower_idx on public.subscriber (lower(email));
create index subscriber_created_idx on public.subscriber (created_at desc);

-- ---------- admin team grant/revoke audit ----------
create table public.admin_role_audit (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,
  actor_email  text,
  target_id    uuid,
  target_email text,
  action       text not null check (action in ('grant', 'revoke')),
  created_at   timestamptz not null default now()
);

-- ---------- admin mutation audit trail ----------
create table public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  actor_email text,
  action      text not null,   -- e.g. order.status, product.price, product.update, product.stock, product.create, setting.update, review.status, order.note
  entity_type text not null,   -- order | product | setting | review
  entity_id   text,            -- order_no / product slug / 'store' / review id
  summary     text,            -- human one-liner ("Confirmed → Shipped")
  meta        jsonb not null default '{}'::jsonb,  -- structured before/after
  created_at  timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- ---------- shared cron secret (RLS-sealed; only definer functions touch it) --
create table public.app_secret (
  name       text primary key,
  value      text not null,
  created_at timestamptz not null default now()
);

-- ---------- web push subscriptions (RLS-sealed; owner-scoped RPCs only) ----
create table public.push_subscription (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ---------- abandoned-cart snapshots (RLS-sealed; owner-scoped RPC only) ----
create table public.cart_snapshot (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  items       jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  -- reminded_at >= updated_at means "already nagged about THIS cart"; any new
  -- cart activity re-arms it.
  reminded_at timestamptz
);
create index cart_snapshot_updated_idx on public.cart_snapshot (updated_at);

-- ---------- returns & exchanges (one per order, v1) ----------
create table public.return_request (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null unique references public."order"(id) on delete cascade,
  user_id             uuid not null references auth.users(id),
  status              text not null default 'Requested'
                        check (status in ('Requested','Approved','Received','Refunded','Exchanged','Rejected')),
  reason              text not null check (length(btrim(reason)) between 1 and 1000),
  -- What the customer asked for; the operator may still settle the other way.
  resolution          text not null check (resolution in ('refund','exchange')),
  -- Required iff resolution = 'refund' — COD has no card to reverse, so the
  -- payout is a manual UPI transfer to this VPA.
  upi_id              text check (resolution <> 'refund' or upi_id is not null),
  -- Storage paths in the private return-photos bucket ({uid}/…), required.
  photos              text[] not null check (array_length(photos, 1) between 1 and 3),
  refund_amount_paise integer check (refund_amount_paise is null or refund_amount_paise >= 0),
  refund_reference    text,
  admin_note          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  resolved_at         timestamptz
);
create index return_request_status_idx  on public.return_request (status, created_at desc);
create index return_request_user_id_idx on public.return_request (user_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════════
-- Functions
-- ════════════════════════════════════════════════════════════════════════

-- ---------- shared helpers ----------

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.sync_product_primary_image()
returns trigger language plpgsql set search_path = '' as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.product p
  set primary_image_url = (
    select url from public.product_image
    where product_id = pid
    order by is_primary desc, sort_order asc, id asc
    limit 1
  )
  where p.id = pid;
  return null;
end $$;

create or replace function public.sync_product_rating()
returns trigger language plpgsql set search_path = '' as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.product p set
    review_count = (select count(*) from public.review where product_id = pid and status = 'approved'),
    rating = coalesce((select round(avg(rating)::numeric, 2)
                       from public.review where product_id = pid and status = 'approved'), 0)
  where p.id = pid;
  return null;
end $$;

-- is_admin(): the single authorization primitive every admin RPC and admin
-- read policy gates on — true iff the caller's JWT app_metadata.role = 'admin'.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- ---------- checkout (storefront) ----------

-- place_order: the authoritative, tamper-proof checkout write path.
--   p_items    jsonb array of { product_id, tone, qty }
--   p_customer jsonb { full_name, phone, email, address_line, city, state, pincode, payment_method }
--   p_coupon   optional raw coupon code
-- Returns { order_no, subtotal_paise, discount_paise, shipping_paise, total_paise, coupon_dropped }.
-- Requires a signed-in customer; locks + decrements product.stock; enforces
-- the store's COD kill-switch; consumes coupon usage atomically.
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

  -- Store-managed config (Settings): shipping + the COD kill-switch.
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

  -- Recompute every line from the authoritative product price; lock the row
  -- so two concurrent orders can't both oversell the last unit.
  for v_item in select value from jsonb_array_elements(p_items) as value loop
    v_qty := floor(coalesce((v_item->>'qty')::numeric, 1))::integer;
    if v_qty < 1 then v_qty := 1; end if;
    if v_qty > 10 then v_qty := 10; end if;  -- lib/cart MAX_LINE_QUANTITY

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

  -- Table-driven coupon: the guarded UPDATE atomically checks (active,
  -- unexpired, under the usage cap, meets the minimum) AND consumes one use
  -- in a single row-locked statement, so concurrent orders can never exceed
  -- usage_limit. If a code was SUPPLIED but nothing matched, flag it dropped
  -- so checkout can tell the customer (the order still stands at the
  -- recomputed total).
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
      v_coupon := null;         -- invalid / expired / exhausted / below-minimum
      v_coupon_dropped := true; -- a code was entered but couldn't be applied
    end if;
  end if;

  -- Shipping is computed on the pre-discount subtotal; a free-shipping
  -- coupon zeroes it.
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

revoke all on function public.place_order(jsonb, jsonb, text) from public;
grant execute on function public.place_order(jsonb, jsonb, text) to authenticated;

-- Read-only confirmation lookup by unguessable order number. No RLS policy is
-- added; this definer function is the only read path. Null when unknown.
create or replace function public.get_order_confirmation(p_order_no text)
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
  where o.order_no = p_order_no;
$$;

revoke all on function public.get_order_confirmation(text) from public;
grant execute on function public.get_order_confirmation(text) to anon, authenticated;

-- customer_cancel_order: mirrors admin_set_order_status's Cancel branch
-- (release the coupon use, restore stock) but scoped to the caller's own
-- order and only from Pending (Confirmed+ means fulfilment has started).
create or replace function public.customer_cancel_order(p_order_no text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_order_id uuid;
  v_status   text;
  v_coupon   text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  select id, status, coupon_code into v_order_id, v_status, v_coupon
    from "order"
   where order_no = p_order_no
     and user_id = v_user_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if v_status <> 'Pending' then
    raise exception 'ORDER_NOT_CANCELLABLE: %', v_status using errcode = 'check_violation';
  end if;

  update "order" set status = 'Cancelled' where id = v_order_id;

  if v_coupon is not null then
    update coupon set usage_count = greatest(0, usage_count - 1) where code = v_coupon;
  end if;

  update product p
     set stock = p.stock + oi.qty
    from order_item oi
   where oi.order_id = v_order_id
     and p.id = oi.product_id;

  return 'Cancelled';
end;
$$;

revoke all on function public.customer_cancel_order(text) from public;
grant execute on function public.customer_cancel_order(text) to authenticated;

-- ---------- admin: orders ----------

-- admin_set_order_status: advances an order along the fulfilment flow
-- (Pending → Confirmed → Packed → Shipped → Delivered), or cancels it.
-- Transition rules:
--   * one step forward, or one step back to undo a mis-click
--   * Cancelled reachable from any non-terminal state (releases the coupon
--     use, restores stock)
--   * Delivered requires a saved AWB, and stamps delivered_at (anchors the
--     return window)
--   * a backward step clears the recorded AWB/tracking link (stale courier
--     details)
--   * Delivered and Cancelled are terminal
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
  v_awb     text;
  v_ci      int;
  v_ni      int;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  select status, coupon_code, awb into v_current, v_coupon, v_awb
    from "order" where id = p_order_id;
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

  -- No delivery without a tracking number on file.
  if p_status = 'Delivered' and (v_awb is null or btrim(v_awb) = '') then
    raise exception 'AWB_REQUIRED' using errcode = 'check_violation';
  end if;

  -- One step forward, or one step back to undo a mis-click.
  v_ci := array_position(v_flow, v_current);
  v_ni := array_position(v_flow, p_status);
  if v_ni is null or (v_ni <> v_ci + 1 and v_ni <> v_ci - 1) then
    raise exception 'INVALID_TRANSITION: % -> %', v_current, p_status
      using errcode = 'check_violation';
  end if;

  -- A backward step invalidates the recorded courier details; the forward
  -- move to Delivered anchors the return window.
  update "order"
     set status       = p_status,
         awb          = case when v_ni = v_ci - 1 then null else awb end,
         tracking_url = case when v_ni = v_ci - 1 then null else tracking_url end,
         delivered_at = case when p_status = 'Delivered' then now() else delivered_at end
   where id = p_order_id;
  return p_status;
end;
$$;

revoke all on function public.admin_set_order_status(uuid, text) from public;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;

-- admin_set_order_awb: records the courier AWB (+ optional tracking link)
-- once a parcel is booked (Shiprocket integration stays deferred).
create or replace function public.admin_set_order_awb(
  p_order_id     uuid,
  p_awb          text,
  p_tracking_url text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awb     text;
  v_url     text;
  v_current text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  v_awb := btrim(coalesce(p_awb, ''));
  if v_awb = '' or length(v_awb) > 40 or v_awb !~ '^[A-Za-z0-9][A-Za-z0-9 /_-]*$' then
    raise exception 'INVALID_AWB' using errcode = 'check_violation';
  end if;

  -- Blank clears; otherwise http(s) only — this renders as a customer-facing
  -- link, so javascript:/data: must never be storable.
  v_url := btrim(coalesce(p_tracking_url, ''));
  if v_url = '' then
    v_url := null;
  elsif length(v_url) > 300 or v_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'INVALID_TRACKING_URL' using errcode = 'check_violation';
  end if;

  select status into v_current from "order" where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Terminal orders are read-only history.
  if v_current in ('Delivered', 'Cancelled') then
    raise exception 'ORDER_TERMINAL: %', v_current using errcode = 'check_violation';
  end if;

  update "order" set awb = v_awb, tracking_url = v_url where id = p_order_id;
  return v_awb;
end;
$$;

revoke all on function public.admin_set_order_awb(uuid, text, text) from public;
grant execute on function public.admin_set_order_awb(uuid, text, text) to authenticated;

-- admin_add_order_note: an internal note, folded into the admin_audit_log
-- timeline as an order.note row (append-only, admin-read).
create or replace function public.admin_add_order_note(
  p_order_no text,
  p_note     text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_note  text := btrim(coalesce(p_note, ''));
  v_row   jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if v_note = '' or char_length(v_note) > 500 then
    raise exception 'INVALID_NOTE';
  end if;

  if not exists (select 1 from "order" where order_no = p_order_no) then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into admin_audit_log (
    actor_id, actor_email, action, entity_type, entity_id, summary
  ) values (
    v_uid, v_email, 'order.note', 'order', p_order_no, v_note
  )
  returning jsonb_build_object(
    'id', id, 'actor_email', actor_email, 'summary', summary,
    'created_at', created_at
  ) into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_add_order_note(text, text)
  to anon, authenticated, service_role;

-- ---------- admin: products & categories ----------

-- admin_upsert_product: insert when p_id is null (a unique slug is generated
-- from the name), otherwise update the row (slug is preserved so storefront
-- URLs don't break). Returns the product id.
create or replace function public.admin_upsert_product(
  p_id      uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_base     text;
  v_slug     text;
  v_bg       jsonb;
  v_gallery  jsonb   := coalesce(p_payload->'gallery', '[]'::jsonb);
  v_plating  text[]  := coalesce(
                          array(select jsonb_array_elements_text(
                            coalesce(p_payload->'plating_options', '[]'::jsonb))),
                          '{}');
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if coalesce(btrim(p_payload->>'name'), '') = '' then
    raise exception 'NAME_REQUIRED' using errcode = 'check_violation';
  end if;
  if coalesce(btrim(p_payload->>'sku'), '') = '' then
    raise exception 'SKU_REQUIRED' using errcode = 'check_violation';
  end if;
  if p_payload->>'category_id' is null then
    raise exception 'CATEGORY_REQUIRED' using errcode = 'check_violation';
  end if;

  if p_id is null then
    -- Slugify the name, then de-dupe with a numeric suffix.
    v_base := btrim(regexp_replace(lower(btrim(p_payload->>'name')), '[^a-z0-9]+', '-', 'g'), '-');
    if v_base = '' then v_base := 'product'; end if;
    v_slug := v_base;
    while exists (select 1 from product where slug = v_slug) loop
      v_slug := v_base || '-' || floor(random() * 9000 + 1000)::int::text;
    end loop;

    insert into product (
      name, sku, slug, category_id, price_paise, mrp_paise, stock, status,
      primary_image_url, gallery, plating_options, material, badge, blurb, desc_long,
      details_plating, details_stones, details_care, shipping_note,
      is_featured, is_fresh
    ) values (
      btrim(p_payload->>'name'), btrim(p_payload->>'sku'), v_slug,
      (p_payload->>'category_id')::uuid,
      (p_payload->>'price_paise')::int,
      nullif(p_payload->>'mrp_paise', '')::int,
      coalesce((p_payload->>'stock')::int, 0),
      coalesce(nullif(p_payload->>'status', ''), 'Active'),
      nullif(p_payload->>'primary_image_url', ''),
      v_gallery,
      v_plating,
      nullif(p_payload->>'material', ''),
      coalesce(nullif(p_payload->>'badge', ''), 'None'),
      nullif(p_payload->>'blurb', ''),
      nullif(p_payload->>'desc_long', ''),
      nullif(p_payload->>'details_plating', ''),
      nullif(p_payload->>'details_stones', ''),
      nullif(p_payload->>'details_care', ''),
      nullif(p_payload->>'shipping_note', ''),
      coalesce((p_payload->>'is_featured')::boolean, false),
      coalesce((p_payload->>'is_fresh')::boolean, false)
    )
    returning id into v_id;
  else
    update product set
      name              = btrim(p_payload->>'name'),
      sku               = btrim(p_payload->>'sku'),
      category_id       = (p_payload->>'category_id')::uuid,
      price_paise       = (p_payload->>'price_paise')::int,
      mrp_paise         = nullif(p_payload->>'mrp_paise', '')::int,
      stock             = coalesce((p_payload->>'stock')::int, 0),
      status            = coalesce(nullif(p_payload->>'status', ''), 'Active'),
      primary_image_url = nullif(p_payload->>'primary_image_url', ''),
      gallery           = v_gallery,
      plating_options   = v_plating,
      material          = nullif(p_payload->>'material', ''),
      badge             = coalesce(nullif(p_payload->>'badge', ''), 'None'),
      blurb             = nullif(p_payload->>'blurb', ''),
      desc_long         = nullif(p_payload->>'desc_long', ''),
      details_plating   = nullif(p_payload->>'details_plating', ''),
      details_stones    = nullif(p_payload->>'details_stones', ''),
      details_care      = nullif(p_payload->>'details_care', ''),
      shipping_note     = nullif(p_payload->>'shipping_note', ''),
      is_featured       = coalesce((p_payload->>'is_featured')::boolean, false),
      is_fresh          = coalesce((p_payload->>'is_fresh')::boolean, false),
      updated_at        = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'PRODUCT_NOT_FOUND' using errcode = 'no_data_found';
    end if;
  end if;

  -- Project the admin-edited gallery onto product_image, which is what the
  -- storefront actually reads (getProducts / getProductBySlug embed it). The
  -- console only ever wrote product.gallery, so image edits never reached the
  -- shop. Rebuild wholesale: keep any bg swatch already held for a surviving
  -- url, order the marked primary first so the one-primary index can't be
  -- violated by a malformed bulk-import row.
  select coalesce(jsonb_object_agg(url, bg) filter (where url is not null and bg is not null),
                  '{}'::jsonb)
    into v_bg
    from product_image where product_id = v_id;

  delete from product_image where product_id = v_id;

  insert into product_image (product_id, url, design_name, bg, is_primary, sort_order)
  select v_id, g.url, g.design_name, v_bg->>g.url, g.rn = 1, g.rn - 1
  from (
    select btrim(im->>'url')                    as url,
           nullif(btrim(im->>'name'), '')       as design_name,
           row_number() over (
             order by coalesce((im->>'primary')::boolean, false) desc, ord) as rn
    from jsonb_array_elements(v_gallery) with ordinality t(im, ord)
    where coalesce(btrim(im->>'url'), '') <> ''
  ) g;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_product(uuid, jsonb) from public;
grant execute on function public.admin_upsert_product(uuid, jsonb) to authenticated;

-- admin_upsert_category: insert when p_id is null (a unique slug is
-- generated, sort_order appended to the end), otherwise update name /
-- description / image_url (slug + sort_order preserved). image_url must be
-- http(s) — it renders as a customer-facing background image.
create or replace function public.admin_upsert_category(
  p_id      uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_base  text;
  v_slug  text;
  v_name  text := btrim(p_payload->>'name');
  v_desc  text := nullif(btrim(p_payload->>'description'), '');
  v_image text := nullif(btrim(coalesce(p_payload->>'image_url', '')), '');
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if coalesce(v_name, '') = '' then
    raise exception 'NAME_REQUIRED' using errcode = 'check_violation';
  end if;

  if v_image is not null
     and (length(v_image) > 500 or v_image !~* '^https?://[^[:space:]]+$') then
    raise exception 'INVALID_IMAGE_URL' using errcode = 'check_violation';
  end if;

  if p_id is null then
    -- Slugify the name, then de-dupe with a numeric suffix.
    v_base := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
    if v_base = '' then v_base := 'category'; end if;
    v_slug := v_base;
    while exists (select 1 from category where slug = v_slug) loop
      v_slug := v_base || '-' || floor(random() * 9000 + 1000)::int::text;
    end loop;

    insert into category (name, slug, description, image_url, sort_order)
    values (
      v_name,
      v_slug,
      v_desc,
      v_image,
      coalesce((select max(sort_order) from category), 0) + 1
    )
    returning id into v_id;
  else
    update category set
      name        = v_name,
      description = v_desc,
      image_url   = v_image
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'CATEGORY_NOT_FOUND' using errcode = 'no_data_found';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_category(uuid, jsonb) from public;
grant execute on function public.admin_upsert_category(uuid, jsonb) to authenticated;

-- admin_delete_category: blocking, not cascading — refuses to delete a
-- category that still holds products (a silent re-home would move a
-- product's URL/breadcrumb out from under the customer).
create or replace function public.admin_delete_category(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  select count(*) into v_count from product where category_id = p_id;
  if v_count > 0 then
    raise exception 'CATEGORY_HAS_PRODUCTS' using errcode = 'foreign_key_violation';
  end if;

  delete from category where id = p_id;
end;
$$;

revoke all on function public.admin_delete_category(uuid) from public;
grant execute on function public.admin_delete_category(uuid) to authenticated;

-- admin_bulk_upsert_*: all-or-nothing bulk upserts for the Excel import. Each
-- loops the single-row admin_upsert_* RPC per element (so validation/slug
-- generation/error codes stay defined in one place); a subtransaction per row
-- catches failures, and any row failing rolls back the whole batch while
-- still surfacing per-row diagnostics via BULK_ROW_ERRORS:<json>.
create or replace function public.admin_bulk_upsert_products(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item    jsonb;
  v_created int := 0;
  v_updated int := 0;
  v_errors  jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) > 2000 then
    raise exception 'BULK_INVALID' using errcode = '23514';
  end if;

  for v_item in select * from jsonb_array_elements(p_rows) loop
    begin
      perform public.admin_upsert_product(
        nullif(v_item->>'id', '')::uuid,
        v_item->'payload');
      if coalesce(v_item->>'id', '') = '' then v_created := v_created + 1;
      else v_updated := v_updated + 1; end if;
    exception when others then
      -- Cap the collected diagnostics so the raised message stays bounded.
      if jsonb_array_length(v_errors) < 50 then
        v_errors := v_errors || jsonb_build_object(
          'row_num', coalesce((v_item->>'row_num')::int, 0),
          'code', SQLSTATE,
          'message', SQLERRM);
      end if;
    end;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    raise exception 'BULK_ROW_ERRORS:%', v_errors::text using errcode = '23514';
  end if;

  return jsonb_build_object('created', v_created, 'updated', v_updated);
end
$$;

create or replace function public.admin_bulk_upsert_categories(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item    jsonb;
  v_created int := 0;
  v_updated int := 0;
  v_errors  jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) > 2000 then
    raise exception 'BULK_INVALID' using errcode = '23514';
  end if;

  for v_item in select * from jsonb_array_elements(p_rows) loop
    begin
      perform public.admin_upsert_category(
        nullif(v_item->>'id', '')::uuid,
        v_item->'payload');
      if coalesce(v_item->>'id', '') = '' then v_created := v_created + 1;
      else v_updated := v_updated + 1; end if;
    exception when others then
      if jsonb_array_length(v_errors) < 50 then
        v_errors := v_errors || jsonb_build_object(
          'row_num', coalesce((v_item->>'row_num')::int, 0),
          'code', SQLSTATE,
          'message', SQLERRM);
      end if;
    end;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    raise exception 'BULK_ROW_ERRORS:%', v_errors::text using errcode = '23514';
  end if;

  return jsonb_build_object('created', v_created, 'updated', v_updated);
end
$$;

create or replace function public.admin_bulk_upsert_coupons(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item    jsonb;
  v_created int := 0;
  v_updated int := 0;
  v_errors  jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) > 2000 then
    raise exception 'BULK_INVALID' using errcode = '23514';
  end if;

  for v_item in select * from jsonb_array_elements(p_rows) loop
    begin
      perform public.admin_upsert_coupon(
        nullif(v_item->>'id', '')::uuid,
        v_item->'payload');
      if coalesce(v_item->>'id', '') = '' then v_created := v_created + 1;
      else v_updated := v_updated + 1; end if;
    exception when others then
      if jsonb_array_length(v_errors) < 50 then
        v_errors := v_errors || jsonb_build_object(
          'row_num', coalesce((v_item->>'row_num')::int, 0),
          'code', SQLSTATE,
          'message', SQLERRM);
      end if;
    end;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    raise exception 'BULK_ROW_ERRORS:%', v_errors::text using errcode = '23514';
  end if;

  return jsonb_build_object('created', v_created, 'updated', v_updated);
end
$$;

revoke all on function public.admin_bulk_upsert_products(jsonb) from public;
revoke all on function public.admin_bulk_upsert_categories(jsonb) from public;
revoke all on function public.admin_bulk_upsert_coupons(jsonb) from public;
revoke all on function public.admin_bulk_upsert_products(jsonb) from anon;
revoke all on function public.admin_bulk_upsert_categories(jsonb) from anon;
revoke all on function public.admin_bulk_upsert_coupons(jsonb) from anon;
grant execute on function public.admin_bulk_upsert_products(jsonb) to authenticated;
grant execute on function public.admin_bulk_upsert_categories(jsonb) to authenticated;
grant execute on function public.admin_bulk_upsert_coupons(jsonb) to authenticated;

-- ---------- admin: coupons ----------

-- admin_upsert_coupon: p_id null → insert (code must be unique); non-null →
-- update. Code is normalised (trim/upper). usage_count is never touched here
-- (only place_order increments it).
create or replace function public.admin_upsert_coupon(p_id uuid, p_payload jsonb)
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
create or replace function public.admin_toggle_coupon(p_id uuid, p_active boolean)
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

revoke all on function public.admin_upsert_coupon(uuid, jsonb) from public;
revoke all on function public.admin_toggle_coupon(uuid, boolean) from public;
grant execute on function public.admin_upsert_coupon(uuid, jsonb) to authenticated;
grant execute on function public.admin_toggle_coupon(uuid, boolean) to authenticated;

-- admin_delete_coupon: a hard delete is safe — coupon has no child rows, and
-- orders store the applied code as plain text (coupon_code, not a foreign
-- key), so deleting a code never orphans an order.
create or replace function public.admin_delete_coupon(p_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  delete from coupon where id = p_id;
  if not found then
    raise exception 'COUPON_NOT_FOUND' using errcode = 'no_data_found';
  end if;
end;
$$;

grant execute on function public.admin_delete_coupon(uuid)
  to anon, authenticated, service_role;

-- ---------- reviews ----------

-- submit_review: signed-in customers only, and only for a product they have
-- a Delivered order for ("Verified Purchase"). One review per product per
-- customer. Lands as 'pending' for the existing admin moderation queue.
create or replace function public.submit_review(
  p_product_id uuid,
  p_rating     integer,
  p_title      text,
  p_body       text,
  p_name       text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_id      uuid;
  v_name    text;
  v_title   text;
  v_body    text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from product where id = p_product_id) then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1
      from "order" o
      join order_item oi on oi.order_id = o.id
     where o.user_id = v_user_id
       and oi.product_id = p_product_id
       and o.status = 'Delivered'
  ) then
    raise exception 'PURCHASE_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING' using errcode = 'check_violation';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  v_body := nullif(btrim(coalesce(p_body, '')), '');
  v_title := nullif(btrim(coalesce(p_title, '')), '');
  if v_name is null or v_body is null or length(v_body) < 10 then
    raise exception 'INVALID_INPUT' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from review
    where product_id = p_product_id and user_id = v_user_id
  ) then
    raise exception 'ALREADY_REVIEWED' using errcode = 'unique_violation';
  end if;

  insert into review (product_id, user_id, name, rating, title, body, status)
  values (p_product_id, v_user_id, v_name, p_rating, v_title, v_body, 'pending')
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$$;

revoke all on function public.submit_review(uuid, integer, text, text, text) from public;
grant execute on function public.submit_review(uuid, integer, text, text, text) to authenticated;

-- admin_set_review_status: moderation write path (the table stays RLS-sealed
-- for writes; admin reads come from the review_admin_read policy below).
create or replace function public.admin_set_review_status(
  p_id     uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  -- Mirror the table's own status check so a bad value fails with a clear
  -- code instead of a raw constraint violation.
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'INVALID_STATUS: %', p_status using errcode = 'check_violation';
  end if;

  update review set status = p_status where id = p_id;
  if not found then
    raise exception 'REVIEW_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  return p_status;
end;
$$;

-- admin_review_contact: reaches the reviewer's email (auth.users) + latest
-- order phone for the console's "Contact reviewer" actions. Legacy
-- user_id-null reviews (pre purchase-requirement) return null contacts.
create or replace function public.admin_review_contact(p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_name    text;
  v_email   text;
  v_phone   text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  select user_id, name into v_user_id, v_name
    from review
   where id = p_review_id;
  if not found then
    raise exception 'REVIEW_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if v_user_id is null then
    return jsonb_build_object('name', v_name, 'email', null, 'phone', null);
  end if;

  select email into v_email
    from auth.users
   where id = v_user_id;

  -- The freshest phone we hold for this customer: their latest order's.
  select customer_phone into v_phone
    from "order"
   where user_id = v_user_id
   order by created_at desc
   limit 1;

  return jsonb_build_object('name', v_name, 'email', v_email, 'phone', v_phone);
end;
$$;

revoke all on function public.admin_review_contact(uuid) from public;
revoke all on function public.admin_review_contact(uuid) from anon;
grant execute on function public.admin_review_contact(uuid) to authenticated;

-- ---------- contact form ----------

-- submit_contact_message: mints the ticket number and stores the enquiry as
-- New. Callable anonymously (the table stays RLS-sealed for direct writes).
create or replace function public.submit_contact_message(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text;
  v_email   text;
  v_phone   text;
  v_subject text;
  v_body    text;
  v_ticket  text;
begin
  v_name    := btrim(coalesce(p_payload->>'name', ''));
  v_email   := btrim(coalesce(p_payload->>'email', ''));
  v_phone   := btrim(coalesce(p_payload->>'phone', ''));
  v_subject := nullif(btrim(coalesce(p_payload->>'subject', '')), '');
  v_body    := btrim(coalesce(p_payload->>'message', ''));

  if v_name = '' or v_email = '' or v_phone = '' or v_body = '' then
    raise exception 'MISSING_FIELDS' using errcode = 'check_violation';
  end if;

  v_name    := left(v_name, 80);
  v_email   := left(v_email, 120);
  v_phone   := left(v_phone, 20);
  v_subject := left(v_subject, 120);
  v_body    := left(v_body, 2000);

  v_ticket := 'TK-'
    || to_char((now() at time zone 'Asia/Kolkata'), 'YYMMDD')
    || '-' || lpad(nextval('contact_message_no_seq')::text, 3, '0');

  insert into contact_message (ticket_no, subject, body, name, email, phone, status)
  values (v_ticket, v_subject, v_body, v_name, v_email, v_phone, 'New');

  return jsonb_build_object('ticket_no', v_ticket);
end;
$$;

grant execute on function public.submit_contact_message(jsonb) to anon, authenticated;

-- admin_set_message_status: moves a ticket New → In Progress → Resolved.
-- Resolving requires a non-empty resolution note; reopening (moving away
-- from Resolved) clears it so a stale summary can't outlive the state it
-- described.
create or replace function public.admin_set_message_status(
  p_id     uuid,
  p_status text,
  p_note   text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if p_status not in ('New', 'In Progress', 'Resolved') then
    raise exception 'INVALID_STATUS: %', p_status using errcode = 'check_violation';
  end if;

  if p_status = 'Resolved' then
    v_note := nullif(btrim(coalesce(p_note, '')), '');
    if v_note is null then
      raise exception 'RESOLUTION_NOTE_REQUIRED' using errcode = 'check_violation';
    end if;
    if length(v_note) > 500 then
      raise exception 'NOTE_TOO_LONG' using errcode = 'check_violation';
    end if;
  else
    -- Reopening: the old summary described a resolution that no longer stands.
    v_note := null;
  end if;

  update contact_message
     set status = p_status,
         resolution_note = v_note
   where id = p_id;
  if not found then
    raise exception 'MESSAGE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  return p_status;
end;
$$;

revoke all on function public.admin_set_message_status(uuid, text, text) from public;
revoke all on function public.admin_set_message_status(uuid, text, text) from anon;
grant execute on function public.admin_set_message_status(uuid, text, text) to authenticated;

-- ---------- newsletter ----------

-- subscribe_email: lowercase, validate, de-dupe idempotently.
create or replace function public.subscribe_email(
  p_email  text,
  p_source text default 'footer'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text;
  v_source text;
begin
  v_email := lower(btrim(coalesce(p_email, '')));

  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'check_violation';
  end if;
  v_email := left(v_email, 120);

  v_source := coalesce(nullif(btrim(p_source), ''), 'footer');
  if v_source not in ('footer', 'checkout', 'popup') then
    v_source := 'footer';
  end if;

  insert into subscriber (email, source)
  values (v_email, v_source)
  on conflict (lower(email)) do nothing;

  -- `already` when the address was on the list — the UI can thank them either way.
  if found then
    return jsonb_build_object('status', 'subscribed');
  else
    return jsonb_build_object('status', 'already');
  end if;
end;
$$;

grant execute on function public.subscribe_email(text, text) to anon, authenticated;

-- admin_remove_subscriber: prune one address from the mailing list.
create or replace function public.admin_remove_subscriber(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  delete from subscriber where id = p_id;
  if not found then
    raise exception 'SUBSCRIBER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  return p_id;
end;
$$;

-- ---------- admin: settings ----------

-- admin_update_settings: the write path for the single `setting` row.
-- razorpay_live is intentionally NOT writable here — the toggle is rendered
-- "Coming soon" until the payments phase. Jsonb blobs are either shallow-
-- merged (store_info, email_copy — partial payloads update only the keys
-- sent) or whole-replaced (banner, homepage_promo, homepage_hero, returns —
-- the form always sends the complete object).
create or replace function public.admin_update_settings(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_PAYLOAD' using errcode = 'check_violation';
  end if;

  update setting set
    store_name =
      case when p_payload ? 'store_name'
        then coalesce(nullif(left(btrim(p_payload->>'store_name'), 120), ''), store_name)
        else store_name end,
    support_email =
      case when p_payload ? 'support_email'
        then nullif(left(btrim(coalesce(p_payload->>'support_email', '')), 160), '')
        else support_email end,
    phone =
      case when p_payload ? 'phone'
        then nullif(left(btrim(coalesce(p_payload->>'phone', '')), 40), '')
        else phone end,
    gstin =
      case when p_payload ? 'gstin'
        then nullif(upper(left(btrim(coalesce(p_payload->>'gstin', '')), 20)), '')
        else gstin end,
    free_ship_threshold_paise =
      case when p_payload ? 'free_ship_threshold_paise'
        then greatest(0, coalesce((p_payload->>'free_ship_threshold_paise')::int, free_ship_threshold_paise))
        else free_ship_threshold_paise end,
    flat_rate_paise =
      case when p_payload ? 'flat_rate_paise'
        then greatest(0, coalesce((p_payload->>'flat_rate_paise')::int, flat_rate_paise))
        else flat_rate_paise end,
    cod_enabled =
      case when p_payload ? 'cod_enabled'
        then coalesce((p_payload->>'cod_enabled')::boolean, cod_enabled)
        else cod_enabled end,
    banner =
      case when p_payload ? 'banner' then p_payload->'banner' else banner end,
    homepage_promo =
      case when p_payload ? 'homepage_promo' then p_payload->'homepage_promo' else homepage_promo end,
    homepage_hero =
      case when p_payload ? 'homepage_hero' then p_payload->'homepage_hero' else homepage_hero end,
    store_info =
      case when p_payload ? 'store_info'
        then coalesce(store_info, '{}'::jsonb) || (p_payload->'store_info')
        else store_info end,
    email_copy =
      case when p_payload ? 'email_copy'
        then coalesce(email_copy, '{}'::jsonb) || (p_payload->'email_copy')
        else email_copy end,
    returns =
      case when p_payload ? 'returns' then p_payload->'returns' else returns end,
    updated_at = now()
  where id = true;

  if not found then
    raise exception 'SETTINGS_ROW_MISSING' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_update_settings(jsonb) to authenticated;

-- ---------- admin: team (grant/revoke admins) ----------

-- admin_list_admins: a definer function is required because the
-- authenticated role cannot read auth.users directly. is_self lets the UI
-- protect the operator's own row (no self-revoke button).
create or replace function public.admin_list_admins()
returns table (id uuid, email text, granted_at timestamptz, is_self boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  return query
    select
      u.id,
      u.email::text,
      coalesce(
        (u.raw_app_meta_data ->> 'role_granted_at')::timestamptz,
        u.created_at
      ) as granted_at,
      (u.id = auth.uid()) as is_self
    from auth.users u
    where u.raw_app_meta_data ->> 'role' = 'admin'
    order by granted_at asc;
end;
$$;

-- admin_grant_role: grant admin to an existing account by email. Cannot
-- create the auth user without the service-role key, so an unknown email
-- raises NO_ACCOUNT (the UI tells the operator to have them sign up first).
create or replace function public.admin_grant_role(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target auth.users%rowtype;
  v_actor_email text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  select * into v_target
  from auth.users
  where lower(email) = lower(trim(p_email));

  if not found then
    raise exception 'NO_ACCOUNT' using errcode = 'no_data_found';
  end if;

  if v_target.raw_app_meta_data ->> 'role' = 'admin' then
    raise exception 'ALREADY_ADMIN' using errcode = 'unique_violation';
  end if;

  update auth.users
  set raw_app_meta_data =
        coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'admin', 'role_granted_at', now())
  where id = v_target.id;

  select email::text into v_actor_email from auth.users where id = auth.uid();
  insert into public.admin_role_audit (actor_id, actor_email, target_id, target_email, action)
  values (auth.uid(), v_actor_email, v_target.id, v_target.email::text, 'grant');

  return v_target.email::text;
end;
$$;

-- admin_revoke_role: guards against removing yourself or the last remaining
-- admin. Also forces a hard logout — deletes the target's auth sessions
-- (kills their refresh token) so a revoked admin can't keep reaching the
-- console on a JWT that hasn't expired yet.
create or replace function public.admin_revoke_role(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target auth.users%rowtype;
  v_admin_count int;
  v_actor_email text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'CANNOT_SELF_REVOKE' using errcode = 'check_violation';
  end if;

  select * into v_target from auth.users where id = p_user_id;
  if not found or v_target.raw_app_meta_data ->> 'role' <> 'admin' then
    raise exception 'NOT_AN_ADMIN' using errcode = 'no_data_found';
  end if;

  select count(*) into v_admin_count
  from auth.users
  where raw_app_meta_data ->> 'role' = 'admin';

  if v_admin_count <= 1 then
    raise exception 'LAST_ADMIN' using errcode = 'check_violation';
  end if;

  update auth.users
  set raw_app_meta_data = (raw_app_meta_data - 'role') - 'role_granted_at'
  where id = p_user_id;

  -- Hard logout: drop their sessions so the stale-claim JWT can't be
  -- refreshed and the current one stops validating (refresh_tokens cascade
  -- off sessions).
  delete from auth.sessions where user_id = p_user_id;

  select email::text into v_actor_email from auth.users where id = auth.uid();
  insert into public.admin_role_audit (actor_id, actor_email, target_id, target_email, action)
  values (auth.uid(), v_actor_email, v_target.id, v_target.email::text, 'revoke');

  return v_target.email::text;
end;
$$;

revoke all on function public.admin_list_admins() from public;
revoke all on function public.admin_grant_role(text) from public;
revoke all on function public.admin_revoke_role(uuid) from public;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_grant_role(text) to authenticated;
grant execute on function public.admin_revoke_role(uuid) to authenticated;

-- ---------- admin: audit trail trigger ----------

-- tg_admin_audit: single AFTER trigger writer wired to order/product/setting/
-- review. is_admin()-gated so only admin-initiated changes are logged
-- (customer writes — checkout stock decrements, self-service cancels — are
-- skipped). tg_argv[0] names the entity so one function serves every table.
create or replace function public.tg_admin_audit()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_entity  text := tg_argv[0];
  v_action  text;
  v_eid     text;
  v_summary text;
  v_meta    jsonb := '{}'::jsonb;
begin
  -- Only admin-initiated changes belong in the admin audit log.
  if not public.is_admin() then
    return coalesce(new, old);
  end if;

  if v_entity = 'order' then
    if new.status is distinct from old.status then
      v_action  := 'order.status';
      v_eid     := new.order_no;
      v_summary := old.status || ' → ' || new.status;
      v_meta    := jsonb_build_object('from', old.status, 'to', new.status);
    else
      return new;
    end if;

  elsif v_entity = 'review' then
    if new.status is distinct from old.status then
      v_action  := 'review.status';
      v_eid     := new.id::text;
      v_summary := old.status || ' → ' || new.status;
      v_meta    := jsonb_build_object('from', old.status, 'to', new.status);
    else
      return new;
    end if;

  elsif v_entity = 'setting' then
    v_action  := 'setting.update';
    v_eid     := 'store';
    v_summary := 'Store settings updated';
    -- Record only the tracked columns that actually changed.
    v_meta    := jsonb_strip_nulls(jsonb_build_object(
      'store_name',
        case when new.store_name is distinct from old.store_name
          then jsonb_build_array(old.store_name, new.store_name) end,
      'support_email',
        case when new.support_email is distinct from old.support_email
          then jsonb_build_array(old.support_email, new.support_email) end,
      'phone',
        case when new.phone is distinct from old.phone
          then jsonb_build_array(old.phone, new.phone) end,
      'gstin',
        case when new.gstin is distinct from old.gstin
          then jsonb_build_array(old.gstin, new.gstin) end,
      'cod_enabled',
        case when new.cod_enabled is distinct from old.cod_enabled
          then jsonb_build_array(old.cod_enabled, new.cod_enabled) end,
      'free_ship_threshold_paise',
        case when new.free_ship_threshold_paise is distinct from old.free_ship_threshold_paise
          then jsonb_build_array(old.free_ship_threshold_paise, new.free_ship_threshold_paise) end,
      'flat_rate_paise',
        case when new.flat_rate_paise is distinct from old.flat_rate_paise
          then jsonb_build_array(old.flat_rate_paise, new.flat_rate_paise) end
    ));

  elsif v_entity = 'product' then
    v_eid := coalesce(new.slug, new.id::text);
    if tg_op = 'INSERT' then
      v_action  := 'product.create';
      v_summary := 'Created ' || new.name;
      v_meta    := jsonb_build_object(
        'price_paise', new.price_paise, 'stock', new.stock, 'status', new.status);
    elsif new.price_paise is distinct from old.price_paise then
      v_action  := 'product.price';
      v_summary := new.name || ': price ' || old.price_paise || ' → ' || new.price_paise || ' (paise)';
      v_meta    := jsonb_build_object('from_paise', old.price_paise, 'to_paise', new.price_paise);
    elsif (new.name, new.sku, new.status, new.mrp_paise, new.category_id,
           new.badge, new.material, new.is_featured, new.is_fresh)
          is distinct from
          (old.name, old.sku, old.status, old.mrp_paise, old.category_id,
           old.badge, old.material, old.is_featured, old.is_fresh) then
      v_action  := 'product.update';
      v_summary := 'Edited ' || new.name;
      v_meta    := jsonb_build_object('status', new.status, 'stock', new.stock);
    elsif new.stock is distinct from old.stock then
      -- Stock-only movement (admin edit or restock on cancel).
      v_action  := 'product.stock';
      v_summary := new.name || ': stock ' || old.stock || ' → ' || new.stock;
      v_meta    := jsonb_build_object('from', old.stock, 'to', new.stock);
    else
      return new;
    end if;

  else
    return coalesce(new, old);
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into admin_audit_log (
    actor_id, actor_email, action, entity_type, entity_id, summary, meta
  ) values (
    v_uid, v_email, v_action, v_entity, v_eid, v_summary, v_meta
  );

  return coalesce(new, old);
end;
$$;

-- ---------- ops: daily digest + web push ----------

-- get_daily_digest: cron has no admin cookie session, so this is gated by a
-- shared secret (app_secret 'cron' row) instead of is_admin(). Aggregates
-- only (counts, revenue, low-stock names) — no customer PII, so a leaked
-- secret exposes numbers, not people. The operator seeds the secret once at
-- deploy: insert into app_secret (name, value) values ('cron', '<long random>');
create or replace function public.get_daily_digest(p_secret text)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_expected  text;
  -- Yesterday in the store's timezone: the completed IST calendar day.
  v_day       date := (now() at time zone 'Asia/Kolkata')::date - 1;
  v_orders    int;
  v_cancelled int;
  v_revenue   bigint;
  v_pending   int;
  v_low_count int;
  v_low       jsonb;
begin
  select value into v_expected from app_secret where name = 'cron';
  if v_expected is null then
    raise exception 'NOT_CONFIGURED';
  end if;
  if p_secret is null or p_secret <> v_expected then
    raise exception 'BAD_SECRET' using errcode = '42501';
  end if;

  -- Yesterday's activity; revenue mirrors the dashboard (cancelled excluded).
  select count(*)::int,
         (count(*) filter (where status = 'Cancelled'))::int,
         coalesce(sum(total_paise) filter (where status <> 'Cancelled'), 0)::bigint
    into v_orders, v_cancelled, v_revenue
    from "order"
   where (created_at at time zone 'Asia/Kolkata')::date = v_day;

  select count(*)::int into v_pending from "order" where status = 'Pending';

  -- Low stock mirrors the dashboard: stock <= 5, worst first, top 5 listed.
  select count(*)::int into v_low_count from product where stock <= 5;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_low
    from (
      select name, sku, stock from product
       where stock <= 5
       order by stock asc, name asc
       limit 5
    ) x;

  return jsonb_build_object(
    'date',            to_char(v_day, 'YYYY-MM-DD'),
    'orders',          v_orders,
    'cancelled',       v_cancelled,
    'revenue_paise',   v_revenue,
    'pending_orders',  v_pending,
    'low_stock_count', v_low_count,
    'low_stock',       v_low
  );
end;
$$;

grant execute on function public.get_daily_digest(text)
  to anon, authenticated, service_role;

-- admin_save_push_subscription: save (or refresh) the calling admin's
-- subscription for one device. Browsers rotate subscriptions, so it upserts.
create or replace function public.admin_save_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  if coalesce(btrim(p_endpoint), '') = ''
     or coalesce(btrim(p_p256dh), '') = ''
     or coalesce(btrim(p_auth), '') = '' then
    raise exception 'INVALID_SUBSCRIPTION';
  end if;

  insert into push_subscription (endpoint, p256dh, auth, user_id, user_agent)
  values (
    btrim(p_endpoint),
    btrim(p_p256dh),
    btrim(p_auth),
    auth.uid(),
    nullif(btrim(coalesce(p_user_agent, '')), '')
  )
  on conflict (endpoint) do update set
    p256dh     = excluded.p256dh,
    auth       = excluded.auth,
    user_id    = excluded.user_id,
    user_agent = excluded.user_agent;
end;
$$;

-- admin_delete_push_subscription: remove the calling admin's subscription
-- for one device ("Disable on this device"). Scoped to the caller's own rows.
create or replace function public.admin_delete_push_subscription(p_endpoint text)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  delete from push_subscription
  where endpoint = btrim(p_endpoint) and user_id = auth.uid();
end;
$$;

-- get_push_subscriptions: full list for the push sender. Gated on the sealed
-- app_secret 'cron' row — the server proves possession of CRON_SECRET.
create or replace function public.get_push_subscriptions(p_secret text)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_expected text;
begin
  select value into v_expected from app_secret where name = 'cron';
  if v_expected is null or p_secret is null or p_secret <> v_expected then
    raise exception 'FORBIDDEN';
  end if;

  return coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'endpoint', s.endpoint,
        'p256dh',   s.p256dh,
        'auth',     s.auth
      ))
      from push_subscription s
    ),
    '[]'::jsonb
  );
end;
$$;

-- prune_push_subscriptions: drop subscriptions the push service reported
-- dead (404/410) — browsers rotate or expire them routinely.
create or replace function public.prune_push_subscriptions(p_secret text, p_endpoints text[])
  returns int
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_expected text;
  v_count    int;
begin
  select value into v_expected from app_secret where name = 'cron';
  if v_expected is null or p_secret is null or p_secret <> v_expected then
    raise exception 'FORBIDDEN';
  end if;

  delete from push_subscription where endpoint = any (p_endpoints);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------- abandoned-cart reminders ----------

-- sync_cart: owner write — upsert the debounced cart snapshot (empty cart
-- deletes the row). Re-builds each item from an allowlist of clamped fields
-- so the reminder email can only ever contain these keys, whatever the
-- client sent. Identical re-syncs (page reloads) keep the old updated_at, so
-- the 24h idle clock measures real cart changes, not mere visits.
create or replace function public.sync_cart(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid;
  v_items jsonb;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS' using errcode = 'check_violation';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'TOO_MANY_ITEMS' using errcode = 'check_violation';
  end if;

  if jsonb_array_length(p_items) = 0 then
    delete from cart_snapshot where user_id = v_user;
    return;
  end if;

  select jsonb_agg(jsonb_build_object(
    'name',             left(coalesce(item->>'name', ''), 120),
    'slug',             nullif(left(coalesce(item->>'slug', ''), 120), ''),
    'qty',              greatest(1, least(10, coalesce((item->>'qty')::int, 1))),
    'unit_price_paise', greatest(0, coalesce((item->>'unit_price_paise')::int, 0)),
    'tone',             nullif(left(coalesce(item->>'tone', ''), 40), '')
  ))
  into v_items
  from jsonb_array_elements(p_items) as item
  where coalesce(item->>'name', '') <> '';

  if v_items is null then
    delete from cart_snapshot where user_id = v_user;
    return;
  end if;

  insert into cart_snapshot (user_id, items, updated_at)
  values (v_user, v_items, now())
  on conflict (user_id) do update
    set items = excluded.items,
        updated_at = case
          when cart_snapshot.items = excluded.items then cart_snapshot.updated_at
          else now()
        end;
end;
$$;

-- get_abandoned_carts: cron read — carts idle past 24h and not yet reminded.
create or replace function public.get_abandoned_carts(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected text;
begin
  select value into v_expected from app_secret where name = 'cron';
  if v_expected is null or p_secret is null or p_secret <> v_expected then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_data)
      from (
        select jsonb_build_object(
          'user_id', c.user_id,
          'email',   u.email,
          'items',   c.items,
          'updated_at', c.updated_at
        ) as row_data
        from cart_snapshot c
        join auth.users u on u.id = c.user_id
        where jsonb_array_length(c.items) > 0
          and c.updated_at <= now() - interval '24 hours'
          and (c.reminded_at is null or c.reminded_at < c.updated_at)
          and u.email is not null
        order by c.updated_at asc
        limit 100
      ) rows
    ),
    '[]'::jsonb
  );
end;
$$;

-- mark_carts_reminded: cron write — record that reminders went out.
create or replace function public.mark_carts_reminded(p_secret text, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected text;
begin
  select value into v_expected from app_secret where name = 'cron';
  if v_expected is null or p_secret is null or p_secret <> v_expected then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update cart_snapshot
     set reminded_at = now()
   where user_id = any(p_user_ids);
end;
$$;

revoke all on function public.sync_cart(jsonb) from public;
revoke all on function public.sync_cart(jsonb) from anon;
grant execute on function public.sync_cart(jsonb) to authenticated;

revoke all on function public.get_abandoned_carts(text) from public;
grant execute on function public.get_abandoned_carts(text) to anon, authenticated;

revoke all on function public.mark_carts_reminded(text, uuid[]) from public;
grant execute on function public.mark_carts_reminded(text, uuid[]) to anon, authenticated;

-- ---------- returns & exchanges ----------

-- customer_request_return: the customer's one write path. Mirrors
-- customer_cancel_order's scoping (order_no + auth.uid(), never a
-- client-supplied id). Enforces: Delivered only, inside the settings-driven
-- window, one request per order, 1–3 photos from the caller's own storage
-- folder, and a plausible UPI VPA when the ask is a refund.
create or replace function public.customer_request_return(
  p_order_no   text,
  p_reason     text,
  p_resolution text,
  p_upi_id     text default null,
  p_photos     text[] default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid;
  v_order_id     uuid;
  v_status       text;
  v_delivered_at timestamptz;
  v_window_days  integer;
  v_reason       text;
  v_upi          text;
  v_photo        text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  -- Settings-driven window; 0 (or an unset/broken blob) means returns are off.
  select coalesce(nullif(btrim(returns->>'window_days'), '')::int, 7)
    into v_window_days from setting limit 1;
  v_window_days := coalesce(v_window_days, 7);
  if v_window_days <= 0 then
    raise exception 'RETURNS_DISABLED' using errcode = 'check_violation';
  end if;

  select id, status, delivered_at into v_order_id, v_status, v_delivered_at
    from "order"
   where order_no = p_order_no
     and user_id = v_user_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if v_status <> 'Delivered' then
    raise exception 'ORDER_NOT_RETURNABLE: %', v_status using errcode = 'check_violation';
  end if;

  if now() > coalesce(v_delivered_at, now()) + make_interval(days => v_window_days) then
    raise exception 'RETURN_WINDOW_CLOSED' using errcode = 'check_violation';
  end if;

  if exists (select 1 from return_request where order_id = v_order_id) then
    raise exception 'RETURN_EXISTS' using errcode = 'unique_violation';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if v_reason = '' or length(v_reason) > 1000 then
    raise exception 'INVALID_REASON' using errcode = 'check_violation';
  end if;

  if p_resolution not in ('refund', 'exchange') then
    raise exception 'INVALID_RESOLUTION' using errcode = 'check_violation';
  end if;

  -- COD refunds are manual UPI payouts — a refund ask must carry a VPA.
  v_upi := lower(btrim(coalesce(p_upi_id, '')));
  if p_resolution = 'refund' then
    if v_upi !~ '^[a-z0-9][a-z0-9._-]{1,255}@[a-z]{2,64}$' then
      raise exception 'INVALID_UPI' using errcode = 'check_violation';
    end if;
  else
    v_upi := null;
  end if;

  if p_photos is null or array_length(p_photos, 1) is null
     or array_length(p_photos, 1) < 1 or array_length(p_photos, 1) > 3 then
    raise exception 'PHOTOS_REQUIRED' using errcode = 'check_violation';
  end if;
  -- Paths must live in the caller's own folder of the return-photos bucket —
  -- a forged path can't point at someone else's upload.
  foreach v_photo in array p_photos loop
    if v_photo not like (v_user_id::text || '/%') then
      raise exception 'INVALID_PHOTO_PATH' using errcode = 'check_violation';
    end if;
  end loop;

  insert into return_request (order_id, user_id, reason, resolution, upi_id, photos)
  values (v_order_id, v_user_id, v_reason, p_resolution, v_upi, p_photos);

  return 'Requested';
end;
$$;

revoke all on function public.customer_request_return(text, text, text, text, text[]) from public;
grant execute on function public.customer_request_return(text, text, text, text, text[]) to authenticated;

-- admin_set_return_status: Requested → Approved | Rejected → Received →
-- Refunded | Exchanged. Refunded requires the paid amount + UPI reference
-- (UTR) and marks the order payment_status = 'refunded' for COD
-- reconciliation. Refunded / Exchanged / Rejected are terminal.
create or replace function public.admin_set_return_status(
  p_return_id           uuid,
  p_status              text,
  p_refund_amount_paise integer default null,
  p_refund_reference    text default null,
  p_admin_note          text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current  text;
  v_order_id uuid;
  v_ref      text;
  v_note     text;
  v_terminal boolean;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  select status, order_id into v_current, v_order_id
    from return_request where id = p_return_id;
  if not found then
    raise exception 'RETURN_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not (
       (v_current = 'Requested' and p_status in ('Approved', 'Rejected'))
    or (v_current = 'Approved'  and p_status = 'Received')
    or (v_current = 'Received'  and p_status in ('Refunded', 'Exchanged'))
  ) then
    raise exception 'INVALID_RETURN_TRANSITION: % -> %', v_current, coalesce(p_status, '?')
      using errcode = 'check_violation';
  end if;

  v_note := nullif(left(btrim(coalesce(p_admin_note, '')), 500), '');
  v_terminal := p_status in ('Refunded', 'Exchanged', 'Rejected');

  if p_status = 'Refunded' then
    v_ref := nullif(left(btrim(coalesce(p_refund_reference, '')), 60), '');
    if p_refund_amount_paise is null or p_refund_amount_paise <= 0 or v_ref is null then
      raise exception 'REFUND_DETAILS_REQUIRED' using errcode = 'check_violation';
    end if;

    update return_request
       set status              = 'Refunded',
           refund_amount_paise = p_refund_amount_paise,
           refund_reference    = v_ref,
           admin_note          = coalesce(v_note, admin_note),
           resolved_at         = now()
     where id = p_return_id;

    -- The COD cash for this order is no longer (fully) held — reconciliation
    -- reads this flag plus the refund columns above.
    update "order" set payment_status = 'refunded' where id = v_order_id;
    return 'Refunded';
  end if;

  update return_request
     set status      = p_status,
         admin_note  = coalesce(v_note, admin_note),
         resolved_at = case when v_terminal then now() else resolved_at end
   where id = p_return_id;
  return p_status;
end;
$$;

revoke all on function public.admin_set_return_status(uuid, text, integer, text, text) from public;
grant execute on function public.admin_set_return_status(uuid, text, integer, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Triggers
-- ════════════════════════════════════════════════════════════════════════

create trigger product_set_updated_at before update on public.product
  for each row execute function public.set_updated_at();

create trigger product_image_set_updated_at before update on public.product_image
  for each row execute function public.set_updated_at();

create trigger product_image_sync_primary
  after insert or update or delete on public.product_image
  for each row execute function public.sync_product_primary_image();

create trigger review_sync_rating
  after insert or update or delete on public.review
  for each row execute function public.sync_product_rating();

create trigger return_request_set_updated_at before update on public.return_request
  for each row execute function public.set_updated_at();

-- Admin audit trail (0026): fires only for admin-context changes (is_admin()
-- gate lives inside tg_admin_audit).
create trigger trg_audit_order
  after update on public."order"
  for each row execute function public.tg_admin_audit('order');

create trigger trg_audit_review
  after update on public.review
  for each row execute function public.tg_admin_audit('review');

create trigger trg_audit_setting
  after update on public.setting
  for each row execute function public.tg_admin_audit('setting');

create trigger trg_audit_product
  after insert or update on public.product
  for each row execute function public.tg_admin_audit('product');

-- ════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ════════════════════════════════════════════════════════════════════════

alter table public.category         enable row level security;
alter table public.product          enable row level security;
alter table public.product_image    enable row level security;
alter table public.product_option   enable row level security;
alter table public.review           enable row level security;
alter table public.setting          enable row level security;
alter table public.customer_profile enable row level security;
alter table public."order"          enable row level security;
alter table public.order_item       enable row level security;
alter table public.coupon           enable row level security;
alter table public.contact_message  enable row level security;
alter table public.subscriber       enable row level security;
alter table public.admin_role_audit enable row level security;
alter table public.admin_audit_log  enable row level security;
alter table public.app_secret       enable row level security;
alter table public.push_subscription enable row level security;
alter table public.cart_snapshot    enable row level security;
alter table public.return_request   enable row level security;

-- ---------- public storefront reads ----------
create policy "public read categories" on public.category for select using (true);
create policy "public read products"   on public.product  for select using (true);
create policy "public read images"     on public.product_image  for select using (true);
create policy "public read options"    on public.product_option for select using (true);
create policy "public read approved reviews" on public.review for select using (status = 'approved');
create policy "public read settings"   on public.setting for select using (true);

-- ---------- customer own-row access ----------
create policy "customer reads own profile" on public.customer_profile
  for select to authenticated using (id = (select auth.uid()));
create policy "customer creates own profile" on public.customer_profile
  for insert to authenticated with check (id = (select auth.uid()));
create policy "customer updates own profile" on public.customer_profile
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "customer reads own orders" on public."order"
  for select to authenticated using (user_id = (select auth.uid()));
create policy "customer reads own order items" on public.order_item
  for select to authenticated using (
    exists (
      select 1 from "order" o
      where o.id = order_item.order_id
        and o.user_id = (select auth.uid())
    )
  );

create policy "customer reads own return requests" on public.return_request
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------- admin reads (additive; OR'd with the above) ----------
create policy "order_admin_read"      on public."order"    for select to authenticated using (public.is_admin());
create policy "order_item_admin_read" on public.order_item for select to authenticated using (public.is_admin());
create policy "review_admin_read"     on public.review     for select to authenticated using (public.is_admin());
create policy "coupon_admin_read"     on public.coupon     for select to authenticated using (public.is_admin());
create policy "contact_message_admin_read" on public.contact_message for select to authenticated using (public.is_admin());
create policy "subscriber_admin_read" on public.subscriber for select to authenticated using (public.is_admin());
create policy "role_audit_admin_read" on public.admin_role_audit for select to authenticated using (public.is_admin());
create policy admin_audit_log_read    on public.admin_audit_log for select to authenticated using (public.is_admin());
create policy "admin reads return requests" on public.return_request for select to authenticated using (public.is_admin());

-- ---------- coupon storefront preview ----------
-- anon/authenticated may read only coupons that are currently usable (active,
-- unexpired, under their usage cap). place_order is the real gate.
create policy "coupon_public_read" on public.coupon
  for select to anon, authenticated
  using (
    is_active
    and (expires_at is null or expires_at > now())
    and (usage_limit is null or usage_count < usage_limit)
  );

-- app_secret, push_subscription, cart_snapshot: RLS enabled with NO
-- policies — nothing reads or writes through PostgREST directly; only
-- SECURITY DEFINER functions (above) touch them.

-- ════════════════════════════════════════════════════════════════════════
-- Storage
-- ════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public read: the storefront and admin thumbnails load images anonymously.
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Admin-only writes (upload / overwrite / delete).
create policy "product_images_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

insert into storage.buckets (id, name, public)
values ('return-photos', 'return-photos', false)
on conflict (id) do nothing;

-- Customers upload evidence into their own {uid}/… folder only.
create policy "return_photos_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'return-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- The owner and admins can read (signed URLs minted server-side under these
-- same policies via the cookie session) — files are never public.
create policy "return_photos_owner_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'return-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

-- Evidence is immutable for customers; admins may prune.
create policy "return_photos_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'return-photos' and public.is_admin());

-- ════════════════════════════════════════════════════════════════════════
-- Realtime
-- ════════════════════════════════════════════════════════════════════════

-- Live admin console: postgres_changes events for the "needs attention"
-- tables. Realtime enforces RLS per subscriber, so only sessions whose
-- policies allow reading a row (the is_admin() policies above) receive its
-- events — an anonymous storefront visitor subscribing to "order" gets
-- nothing. Guarded DO blocks: a table already in the publication is a no-op.
do $$
begin
  alter publication supabase_realtime add table public."order";
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.review;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.contact_message;
exception
  when duplicate_object then null;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- No data beyond this point
-- ════════════════════════════════════════════════════════════════════════
--
-- This file creates schema only. Row data lives in `supabase/seed.sql`
-- (the settings singleton and the BRIDE20 coupon the storefront advertises)
-- and `supabase/seed_demo.sql` (a demo catalogue for dev/staging).
--
-- The storage.buckets inserts above are the deliberate exception: the bucket
-- rows ARE the storage configuration, the policies beside them reference those
-- ids, and uploads fail without them — they are structure, not content.
--
-- The first admin is granted by hand, per environment; `seed.sql` §2 carries
-- the statement. It is not scripted here because a migration must not hardcode
-- one person's email into every database built from it.

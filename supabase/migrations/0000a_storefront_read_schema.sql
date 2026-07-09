-- 0000a_storefront_read_schema.sql — base storefront schema (Phase 0)
--
-- ⚠️ Captured 2026-07-10 from the live project's migration history
-- (`supabase_migrations.schema_migrations` version 20260630121950,
-- "storefront_read_schema"): this and 0000b were applied to the live DB at
-- project start but never committed as files, so a fresh deploy running the
-- repo's migrations alone had NO base tables (0001+ all assume them). Content
-- is verbatim from the applied migration — do NOT re-apply to the live
-- project (naolegptozpaiojozzcy); it is already there.

-- JR Jewellers — storefront read-path schema (Phase 0)
-- Money stored as integer paise. Timestamps are timestamptz (UTC).

create extension if not exists "pgcrypto";

-- ---------- categories ----------
create table public.category (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  hero_bg     text,                       -- css gradient/color placeholder until real imagery
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- products ----------
create table public.product (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  sku             text not null unique,
  name            text not null,
  category_id     uuid not null references public.category(id) on delete restrict,
  material        text,
  badge           text not null default 'None'
                    check (badge in ('None','Bestseller','New','Bridal Edit')),
  price_paise     int  not null check (price_paise >= 0),
  mrp_paise       int  check (mrp_paise is null or mrp_paise >= price_paise),
  stock           int  not null default 0,
  status          text not null default 'Active'
                    check (status in ('Active','Low stock','Out of stock','Draft')),
  blurb           text,                    -- short description (card + product hero)
  desc_long       text,
  details_plating text,
  details_stones  text,
  details_care    text,
  shipping_note   text,
  rating          numeric(2,1) not null default 0,
  review_count    int  not null default 0,
  is_featured     boolean not null default false,  -- "Bestselling" rail on home
  is_fresh        boolean not null default false,  -- "New Arrivals" rail on home
  created_at      timestamptz not null default now()
);
create index product_category_idx on public.product(category_id);
create index product_status_idx   on public.product(status);

-- ---------- product images / designs ----------
create table public.product_image (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.product(id) on delete cascade,
  url         text,                        -- null => render placeholder
  design_name text,
  bg          text,                        -- placeholder gradient swatch
  is_primary  boolean not null default false,
  sort_order  int not null default 0
);
create index product_image_product_idx on public.product_image(product_id);

-- ---------- plating-tone options ----------
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
  name        text not null,
  rating      int  not null check (rating between 1 and 5),
  title       text,
  body        text,
  status      text not null default 'approved'
                check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);
create index review_product_idx on public.review(product_id);

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
  updated_at                timestamptz not null default now()
);

-- ---------- RLS: public read-only for the storefront ----------
alter table public.category       enable row level security;
alter table public.product        enable row level security;
alter table public.product_image  enable row level security;
alter table public.product_option enable row level security;
alter table public.review         enable row level security;
alter table public.setting        enable row level security;

create policy "public read categories"   on public.category       for select using (true);
create policy "public read products"      on public.product        for select using (true);
create policy "public read images"        on public.product_image  for select using (true);
create policy "public read options"       on public.product_option for select using (true);
create policy "public read approved reviews" on public.review      for select using (status = 'approved');
create policy "public read settings"      on public.setting        for select using (true);
-- Writes are intentionally not granted to anon; admin (Phase 3) will use the
-- service role / authenticated policies.

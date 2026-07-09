-- 0000b_storefront_scale_hardening.sql — production hardening (Phase 0)
--
-- ⚠️ Captured 2026-07-10 from the live project's migration history
-- (`supabase_migrations.schema_migrations` version 20260630130636,
-- "storefront_scale_hardening") — see 0000a's header for why. Verbatim from
-- the applied migration; do NOT re-apply to the live project.

-- Task 0.0: production-readiness hardening for storefront reads/writes.
-- All trigger functions pin search_path='' and fully schema-qualify (Supabase advisor hygiene).

-- 1) updated_at infrastructure -------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

alter table public.product       add column if not exists updated_at timestamptz not null default now();
alter table public.product_image add column if not exists updated_at timestamptz not null default now();

drop trigger if exists product_set_updated_at on public.product;
create trigger product_set_updated_at before update on public.product
  for each row execute function public.set_updated_at();

drop trigger if exists product_image_set_updated_at on public.product_image;
create trigger product_image_set_updated_at before update on public.product_image
  for each row execute function public.set_updated_at();

-- 2) integrity CHECKs (the partial indexes below depend on exact status values) -
alter table public.product
  add constraint product_status_chk check (status in ('Active','Low stock','Out of stock','Draft'));
alter table public.product
  add constraint product_badge_chk check (badge in ('None','Bestseller','New','Bridal Edit'));
alter table public.review
  add constraint review_status_chk check (status in ('pending','approved','rejected'));

-- 3) guarantee one primary image per product, then enforce it ------------------
update public.product_image pi set is_primary = false
where pi.is_primary
  and exists (
    select 1 from public.product_image p2
    where p2.product_id = pi.product_id and p2.is_primary
      and (p2.sort_order, p2.id) < (pi.sort_order, pi.id)
  );

create unique index if not exists product_image_one_primary
  on public.product_image (product_id) where is_primary;

-- 4) denormalized primary image url for join-free listing reads ----------------
alter table public.product add column if not exists primary_image_url text;

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

drop trigger if exists product_image_sync_primary on public.product_image;
create trigger product_image_sync_primary
  after insert or update or delete on public.product_image
  for each row execute function public.sync_product_primary_image();

update public.product p set primary_image_url = (
  select url from public.product_image
  where product_id = p.id
  order by is_primary desc, sort_order asc, id asc
  limit 1
);

-- 5) keep denormalized rating / review_count honest ---------------------------
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

drop trigger if exists review_sync_rating on public.review;
create trigger review_sync_rating
  after insert or update or delete on public.review
  for each row execute function public.sync_product_rating();

-- 6) full-text search (immutable to_tsvector via regconfig cast) ---------------
alter table public.product add column if not exists search tsvector
  generated always as (
    to_tsvector('simple'::regconfig,
      coalesce(name,'') || ' ' || coalesce(blurb,'') || ' ' || coalesce(material,''))
  ) stored;
create index if not exists product_search_idx on public.product using gin (search);

-- 7) query-pattern partial indexes --------------------------------------------
create index if not exists product_active_by_cat
  on public.product (category_id, created_at desc) where status = 'Active';
create index if not exists product_featured_idx
  on public.product (created_at desc) where is_featured;

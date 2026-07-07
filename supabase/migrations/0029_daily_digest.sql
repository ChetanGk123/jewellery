-- 0029_daily_digest.sql
-- TASKS 5.17 — close-of-day digest email. A cron has no admin cookie session,
-- and this app deliberately runs without the service-role key, so the digest
-- data comes through the same pattern as the other unauthenticated-but-gated
-- paths (place_order, get_order_confirmation): a SECURITY DEFINER RPC callable
-- with the anon key, gated here by a shared secret.
--
-- The secret lives in `app_secret` — RLS enabled with NO policies, so nothing
-- reads or writes it through the API; only definer functions can. The operator
-- inserts it once at deploy (SQL editor) with the same value as the CRON_SECRET
-- env var:
--   insert into app_secret (name, value) values ('cron', '<long random>');
--
-- The RPC returns AGGREGATES ONLY (counts, revenue, low-stock product names) —
-- no customer PII — so even a leaked secret exposes numbers, not people.

create table if not exists public.app_secret (
  name       text primary key,
  value      text not null,
  created_at timestamptz not null default now()
);

alter table public.app_secret enable row level security;

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

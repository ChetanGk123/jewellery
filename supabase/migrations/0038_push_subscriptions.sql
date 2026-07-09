-- 0038_push_subscriptions.sql — Web Push for the admin console (6.17)
--
-- Admins can enable system notifications per device (Settings → Notifications):
-- the browser's push subscription (endpoint + encryption keys) is stored here,
-- and the app server sends a push when an order / cancellation / contact
-- message / review arrives.
--
-- Access model mirrors app_secret + the daily digest (0029):
--   * RLS enabled with NO policies — nothing reads or writes this table
--     through PostgREST directly. Subscription endpoints + keys let anyone
--     holding the VAPID private key address a device, so they stay sealed.
--   * Admin sessions manage their own rows through is_admin()-gated definer
--     RPCs (save / delete).
--   * The app server (which pushes on storefront events under an anon or
--     customer session) reads the list through a cron-secret-gated definer
--     RPC — the same shared-secret gate as get_daily_digest.

create table if not exists public.push_subscription (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.push_subscription enable row level security;

-- Save (or refresh) the calling admin's subscription for one device. Browsers
-- rotate subscriptions, so the endpoint upserts.
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

-- Remove the calling admin's subscription for one device ("Disable on this
-- device"). Scoped to the caller's own rows.
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

-- Full subscription list for the push sender. Gated on the sealed app_secret
-- 'cron' row (0029) — the server proves possession of CRON_SECRET.
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

-- Drop subscriptions the push service reported dead (404/410) — browsers
-- rotate or expire them routinely. Same secret gate as above.
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

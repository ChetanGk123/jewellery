-- 0041_cart_snapshots.sql — TASKS 6.19 abandoned-cart emails
--
-- The cart lives in localStorage (client-only), so the server can't know a
-- signed-in customer walked away from a full cart. This adds a per-user cart
-- snapshot the storefront syncs (debounced) whenever the cart changes, plus
-- the cron-side RPCs that find carts idle >24h and record that a reminder was
-- sent. Anonymous carts are invisible by design — there's no address to mail.
--
-- Access model mirrors push_subscription (0038): the table is RLS-sealed
-- (zero policies); the owner writes through an auth-gated definer RPC, and
-- the cron reads through app_secret-gated RPCs (0029's 'cron' row).

create table if not exists public.cart_snapshot (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  items       jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  -- When the abandonment reminder went out. reminded_at >= updated_at means
  -- "already nagged about THIS cart"; any new cart activity re-arms it.
  reminded_at timestamptz
);

alter table public.cart_snapshot enable row level security;

create index if not exists cart_snapshot_updated_idx on public.cart_snapshot (updated_at);

-- ── Owner write: upsert the snapshot (empty cart deletes the row) ─────────────
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

  -- Empty cart → nothing to remind about; drop the row entirely.
  if jsonb_array_length(p_items) = 0 then
    delete from cart_snapshot where user_id = v_user;
    return;
  end if;

  -- Re-build each item from an allowlist of clamped fields so the reminder
  -- email can only ever contain these keys, whatever the client sent.
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

  -- Identical re-syncs (page reloads) keep the old updated_at, so the 24h
  -- idle clock measures real cart changes, not mere visits.
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

-- ── Cron read: carts idle past the threshold and not yet reminded ─────────────
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

-- ── Cron write: record that reminders went out ────────────────────────────────
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

-- Execution surface (0037/0039 pattern). sync_cart needs a session, so
-- authenticated only; the cron RPCs are called with the publishable key
-- (anon role) by the server route, gated by the secret inside.
revoke all on function public.sync_cart(jsonb) from public;
revoke all on function public.sync_cart(jsonb) from anon;
grant execute on function public.sync_cart(jsonb) to authenticated;

revoke all on function public.get_abandoned_carts(text) from public;
grant execute on function public.get_abandoned_carts(text) to anon, authenticated;

revoke all on function public.mark_carts_reminded(text, uuid[]) from public;
grant execute on function public.mark_carts_reminded(text, uuid[]) to anon, authenticated;

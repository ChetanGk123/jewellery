-- 0017_subscribers.sql — TASKS 3.9 Subscribers (newsletter audience)
--
-- Lands the `subscriber` table + its write paths. The footer "Stay in touch"
-- form was UI-only; it now saves through `subscribe_email`, a SECURITY DEFINER
-- RPC callable by anon (the table stays RLS-sealed — no public insert policy)
-- that lowercases + de-duplicates the address idempotently. Admins read the
-- whole mailing list (is_admin() RLS) and prune it through
-- `admin_remove_subscriber` (same RPC-only write model as messages / reviews /
-- coupons; no service key). Only `footer` is used in v1; the `source` check
-- already allows `checkout` / `popup` for the deferred opt-in surfaces.

create table if not exists subscriber (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text not null default 'footer'
             check (source in ('footer', 'checkout', 'popup')),
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness: one row per address regardless of typed casing.
-- The RPC also stores the lowercased form, so this is belt-and-suspenders.
create unique index if not exists subscriber_email_lower_idx
  on subscriber (lower(email));

create index if not exists subscriber_created_idx
  on subscriber (created_at desc);

alter table subscriber enable row level security;

-- Admins read the whole list. No public read, no public insert — writes are RPC-only.
drop policy if exists "subscriber_admin_read" on subscriber;
create policy "subscriber_admin_read" on subscriber
  for select to authenticated using (public.is_admin());

-- ── Public subscribe: lowercase, validate, de-dupe ────────────────────────────
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

  -- Minimal shape check at the write boundary (the server action validates too,
  -- but this RPC is anon-callable). Mirrors the storefront email rule.
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

-- ── Admin: remove one subscriber ──────────────────────────────────────────────
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

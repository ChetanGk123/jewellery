-- 0023_admin_team.sql — In-console admin management ("Team" page)
--
-- Until now, granting admin was a manual SQL edit to auth.users (see 0005). This
-- adds an in-console path: list / grant / revoke admins from /admin/team, with an
-- audit trail — WITHOUT putting a service-role key in the app.
--
-- Same trick every admin write uses (cf. admin_set_order_status in 0007): the
-- functions are SECURITY DEFINER (they run as the DB owner, so they may touch the
-- privileged auth schema), but each re-checks public.is_admin() (0006, the JWT
-- app_metadata.role claim) first, so only an existing admin's own cookie session
-- can call them. The anon/publishable key carries no claim and is rejected.
--
-- Grant stamps app_metadata.role = 'admin' plus role_granted_at (a timestamp the
-- list surfaces as "admin since"); revoke strips both. is_admin() only reads
-- 'role', so the extra key is inert to the gate. As with 0005, a change rides in
-- the JWT and applies on the user's NEXT token refresh (sign out / back in).

-- Audit log: one row per grant/revoke. Only the SECURITY DEFINER functions below
-- insert into it; admins read it via RLS. Actor/target emails are denormalised so
-- the log stays legible even after an account is later removed.
create table if not exists public.admin_role_audit (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,
  actor_email  text,
  target_id    uuid,
  target_email text,
  action       text not null check (action in ('grant', 'revoke')),
  created_at   timestamptz not null default now()
);

alter table public.admin_role_audit enable row level security;

-- Admins read the log; nobody writes through RLS (inserts come only from the
-- definer functions, which bypass RLS as the table owner).
drop policy if exists "role_audit_admin_read" on public.admin_role_audit;
create policy "role_audit_admin_read" on public.admin_role_audit
  for select to authenticated using (public.is_admin());

-- List current admins. A definer function is required because the authenticated
-- role cannot read auth.users directly. `is_self` lets the UI protect the
-- operator's own row (no self-revoke button).
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

-- Grant admin to an existing account by email. We can't create the auth user
-- without the service-role key, so an unknown email raises NO_ACCOUNT (the UI
-- tells the operator to have them sign up first).
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

-- Revoke admin from a user id. Guards against the two ways this bricks the
-- console: removing yourself, or removing the last remaining admin.
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

  select email::text into v_actor_email from auth.users where id = auth.uid();
  insert into public.admin_role_audit (actor_id, actor_email, target_id, target_email, action)
  values (auth.uid(), v_actor_email, v_target.id, v_target.email::text, 'revoke');

  return v_target.email::text;
end;
$$;

-- Sealed by default; only authenticated admins may call (the is_admin() guard
-- rejects non-admins at runtime). Mirrors the 0007 footer.
revoke all on function public.admin_list_admins() from public;
revoke all on function public.admin_grant_role(text) from public;
revoke all on function public.admin_revoke_role(uuid) from public;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_grant_role(text) to authenticated;
grant execute on function public.admin_revoke_role(uuid) to authenticated;

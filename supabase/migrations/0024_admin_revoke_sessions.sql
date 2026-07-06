-- 0024_admin_revoke_sessions.sql — Make admin revoke a hard logout
--
-- 0023's admin_revoke_role only stripped app_metadata.role. But that claim rides
-- in the user's already-issued JWT until it refreshes (~1h), and their session
-- keeps minting fresh tokens that STILL carry the old claim — so a just-revoked
-- admin could keep reaching the console (the Edge gate verifies the JWT locally
-- via getClaims(), no DB check). Closing that: revoke now also deletes the user's
-- auth sessions, which kills their refresh token and invalidates the session the
-- access token is bound to. The next server check (requireAdmin → getUser()) then
-- fails and redirects them out, immediately — no waiting for token expiry.
--
-- auth.sessions is reachable here because the function is SECURITY DEFINER and
-- owned by the migration role (postgres), same as its reads of auth.users.

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

  -- Hard logout: drop their sessions so the stale-claim JWT can't be refreshed
  -- and the current one stops validating. (refresh_tokens cascade off sessions.)
  delete from auth.sessions where user_id = p_user_id;

  select email::text into v_actor_email from auth.users where id = auth.uid();
  insert into public.admin_role_audit (actor_id, actor_email, target_id, target_email, action)
  values (auth.uid(), v_actor_email, v_target.id, v_target.email::text, 'revoke');

  return v_target.email::text;
end;
$$;

revoke all on function public.admin_revoke_role(uuid) from public;
grant execute on function public.admin_revoke_role(uuid) to authenticated;

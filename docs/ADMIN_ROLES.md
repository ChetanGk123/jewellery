# Admin roles — SQL runbook

How a user's role is stored, and the raw SQL to change it.

## Where the role lives

There is **no `role` column**. The role is the `role` key inside
`auth.users.raw_app_meta_data`, and the only value is `'admin'` — absent means a
regular customer. `public.is_admin()` reads it off the JWT
(`app_metadata.role`), which is what every RLS policy gates on:

```sql
select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
```

See `supabase/migrations/0001_initial_schema.sql:376`.

## Prefer the RPCs

Day to day, use the functions the admin console already calls. They enforce
caller-is-admin, block self-revoke and removing the last admin, write an
`admin_role_audit` row, and kill the target's sessions on revoke:

```sql
select public.admin_grant_role('someone@example.com');
select public.admin_revoke_role('<user-uuid>');
select * from public.admin_list_admins();
```

The raw SQL below bypasses all of that — including the audit trail. Use it only
to **bootstrap the first admin**, or to recover when you've locked yourself out.

## Grant admin

Run as superuser (Supabase SQL editor or `psql`):

```sql
update auth.users
set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'admin', 'role_granted_at', now())
where lower(email) = lower('someone@example.com');
```

## Revoke admin

Drop the sessions too — otherwise a live JWT still carries `role: admin` until
it expires.

```sql
update auth.users
set raw_app_meta_data = (raw_app_meta_data - 'role') - 'role_granted_at'
where lower(email) = lower('someone@example.com');

delete from auth.sessions
where user_id = (
  select id from auth.users where lower(email) = lower('someone@example.com')
);
```

## List current admins

```sql
select
  id,
  email,
  raw_app_meta_data ->> 'role'            as role,
  raw_app_meta_data ->> 'role_granted_at' as granted_at
from auth.users
where raw_app_meta_data ->> 'role' = 'admin';
```

## Caveats

- The account must already exist — sign the user up first. Without a
  service-role key the app can't create the `auth.users` row, which is why
  `admin_grant_role` raises `NO_ACCOUNT` for an unknown email.
- The change only reaches the app once the JWT refreshes. Have the user sign
  out and back in.
- Every raw `update` here skips `admin_role_audit`. If you're bootstrapping,
  note it somewhere; if you're not, use the RPCs.

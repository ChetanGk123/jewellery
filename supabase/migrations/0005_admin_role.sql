-- 0005_admin_role.sql — Admin authorization for the (admin) console (Phase 3.1)
--
-- Admin access is a role stamped into a user's app_metadata: a JWT claim that
-- only the service role can set, so a customer can never self-grant it. The
-- console gate checks `app_metadata.role = 'admin'` in three places:
--   lib/admin/roles.ts   (isAdmin — pure claim check)
--   lib/admin/auth.ts    (requireAdmin — authoritative server gate)
--   proxy.ts             (coarse redirect off /admin/*)
--
-- Grant the store owner. To add more admins, duplicate the statement with their
-- email. No-op (0 rows) if the account hasn't signed up yet — re-run afterwards.
--
-- NOTE: app_metadata rides in the JWT, so a change takes effect on the user's
-- NEXT token refresh — sign out and back in to apply it immediately.

update auth.users
set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where email = 'chetangkajjidoni@gmail.com';

-- supabase/seed.sql — MANDATORY bootstrap for a fresh database.
--
-- One of three files, with a strict division of labour:
--
--   supabase/migrations/0001_initial_schema.sql  structure only, zero rows
--   supabase/seed.sql                            THIS FILE — the minimum rows
--                                                the app needs to function
--   supabase/seed_demo.sql                       optional demo catalogue and
--                                                traffic, for dev/staging
--
-- Run this once, immediately after the migration, on EVERY environment
-- including production. The app is broken in specific, confusing ways without
-- it — each section below says exactly how.
--
--     psql "$DATABASE_URL" -f supabase/seed.sql
--
-- …or paste into the Supabase SQL editor. Either way the final statement prints
-- the generated credentials — copy them before closing the tab.
--
-- Every statement is idempotent: re-running changes nothing except §3, which
-- deliberately rotates the cron secret.

begin;

-- `gen_random_bytes` (pgcrypto) is in `extensions` on Supabase and `public` on
-- some self-hosted stacks; this resolves it either way.
set local search_path = public, extensions;

-- Collects the values you have to copy out, so they arrive as one result set
-- at the end instead of scrolling past in the log.
create temporary table _bootstrap_output (
  ord   int,
  item  text,
  value text
) on commit drop;

-- ════════════════════════════════════════════════════════════════════════
-- 1. The settings singleton
-- ════════════════════════════════════════════════════════════════════════
-- REQUIRED. `admin_update_settings` is an `UPDATE ... WHERE id = true` with no
-- insert, and raises SETTINGS_ROW_MISSING when the row is absent — so without
-- this, every save on the admin Settings page fails. (Learned the hard way in
-- the 2026-07-08 DB reset; see TASKS.md.)
--
-- Only `store_name` is set explicitly: the column default still reads
-- 'JR Jewellers' (historical) while the brand is 'RJ Jewellers'. Everything
-- else takes its column default — free shipping over ₹999, ₹79 flat below
-- that, COD on — and every jsonb blob stays `{}` on purpose. Empty blobs make
-- the storefront fall back to the constants in `lib/store-info.ts`,
-- `lib/email/copy.ts` and friends, which are real, shippable copy. Fill them in
-- through the admin console when the store's own details are ready; nothing
-- here needs to be edited first.

insert into setting (id, store_name)
values (true, 'RJ Jewellers')
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 2. The advertised launch coupon
-- ════════════════════════════════════════════════════════════════════════
-- REQUIRED, because the storefront hardcodes it: the cart's coupon input
-- renders `placeholder="Coupon code (try BRIDE20)"`
-- (components/storefront/cart/CouponField.tsx). Without this row a fresh deploy
-- invites every customer to type a code that gets rejected.
--
-- BRIDE20 = 20% off, no minimum, no cap, no expiry. Edit or deactivate it in
-- the admin console like any other coupon.

insert into coupon (code, kind, value)
values ('BRIDE20', 'percent', 20)
on conflict (code) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Cron secret
-- ════════════════════════════════════════════════════════════════════════
-- Needed for the daily digest and abandoned-cart reminders. Two gates share one
-- value: the route checks the bearer token against the CRON_SECRET env var, and
-- `get_daily_digest` re-checks it against this row — so a leaked URL alone
-- yields nothing. They must match exactly.
--
-- Generated here rather than left as a placeholder, so there is nothing to
-- invent and nothing weak committed to the repo. Re-running ROTATES it, which
-- means the env var has to be updated to match or the digest starts failing.
-- Skip this section if you are not using cron; /api/cron/* simply returns 503.

insert into app_secret (name, value)
values ('cron', encode(gen_random_bytes(32), 'hex'))
on conflict (name) do update set value = excluded.value;

insert into _bootstrap_output
select 1, 'CRON_SECRET (env var + this row must match)', value
from app_secret where name = 'cron';

-- ════════════════════════════════════════════════════════════════════════
-- 4. The first admin
-- ════════════════════════════════════════════════════════════════════════
-- REQUIRED, and it cannot be done through the app: `admin_grant_role` gates on
-- `is_admin()`, which needs an admin to already exist. The first one has to be
-- written straight into auth.users.
--
-- `app_metadata.role = 'admin'` is what `is_admin()` reads out of the JWT, so
-- it is the whole grant. `email_confirmed_at` is pre-set because a self-hosted
-- stack often cannot send confirmation mail at all (the blueprint ships an SMTP
-- host that does not exist — see docs/PRODUCTION_ENV.md §1).
--
-- The password is set below and re-asserted on every run, so the seed is
-- idempotent: re-running it always leaves this account signable-in with the
-- password in `v_password`. Change it there, or from the SQL editor:
--   update auth.users set encrypted_password = crypt('<new password>', gen_salt('bf'))
--    where email = '<the address below>';
--
-- ⚠️ EDIT THE EMAIL on the next line before running — it is the account you
--    will sign in to /admin with.

do $$
declare
  v_admin_email text := 'owner@example.com';   -- ← CHANGE ME
  v_password    text := 'Shop@owner';
  v_admin_id    uuid;
  v_existing    uuid;
  v_has_provider_id boolean;
begin
  select id into v_existing from auth.users where email = v_admin_email;

  if v_existing is not null then
    -- Already there: re-assert the role AND the password, so the credential
    -- printed below is always the one that actually works.
    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
             || jsonb_build_object('role', 'admin', 'role_granted_at', now()),
           encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now())
     where id = v_existing;

    insert into _bootstrap_output values
      (2, 'Admin account',  v_admin_email || ' (already existed — role + password re-asserted)'),
      (3, 'Admin password', v_password);
    return;
  end if;

  v_admin_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
    v_admin_email, crypt(v_password, gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', array['email'],
                       'role', 'admin', 'role_granted_at', now()),
    jsonb_build_object('full_name', 'Store Admin'),
    now(), now(), '', '', '', ''
  );

  -- GoTrue needs a matching identity row for password sign-in. `provider_id`
  -- only exists on newer releases, so branch rather than assume.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into v_has_provider_id;

  if v_has_provider_id then
    insert into auth.identities (id, user_id, identity_data, provider, provider_id,
                                 last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_admin_id,
            jsonb_build_object('sub', v_admin_id::text, 'email', v_admin_email,
                               'email_verified', true),
            'email', v_admin_id::text, now(), now(), now());
  else
    insert into auth.identities (id, user_id, identity_data, provider,
                                 last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_admin_id,
            jsonb_build_object('sub', v_admin_id::text, 'email', v_admin_email,
                               'email_verified', true),
            'email', now(), now(), now());
  end if;

  -- Mirrors what `admin_grant_role` would have written, so the Team page shows
  -- how this account got its role.
  insert into public.admin_role_audit (target_id, target_email, action, actor_email)
  values (v_admin_id, v_admin_email, 'grant', 'seed.sql');

  insert into _bootstrap_output values
    (2, 'Admin email',    v_admin_email),
    (3, 'Admin password', v_password);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Deliberately NOT here
-- ════════════════════════════════════════════════════════════════════════
--
-- • Catalogue (products, categories, further coupons) — the operator enters it
--   through the admin console or the bulk .xlsx import. For a populated
--   dev/staging database, run `supabase/seed_demo.sql` instead.
--
-- • Storage buckets — those are created by the migration, alongside the
--   policies that reference them; they are structure, not seed data.
--
-- • Supabase Auth configuration (SITE_URL, redirect allow-list, SMTP, OAuth) —
--   stack env, not database rows. See docs/PRODUCTION_ENV.md §1.

select item, value from _bootstrap_output order by ord;

commit;

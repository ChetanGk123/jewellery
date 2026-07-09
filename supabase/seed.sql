-- supabase/seed.sql — one-time data seed for a FRESH deploy (TASKS 6.15 follow-up)
--
-- Run ONCE after applying every migration (0000a–0040) to a new Supabase
-- project — via the SQL editor, `psql`, or `supabase db reset` (which applies
-- this file automatically for local/branch databases). Every statement is
-- idempotent, so re-running is harmless.
--
-- Why this exists: migrations create the SCHEMA but not the one row the app
-- assumes. `setting` is a singleton — `admin_update_settings` (0018) is
-- `UPDATE ... WHERE id = true` with no insert and raises SETTINGS_ROW_MISSING
-- when the row is absent, so a migrations-only deploy breaks every Settings
-- save (learned the hard way in the 2026-07-08 DB reset; see TASKS.md).

-- ── 1. The settings singleton ─────────────────────────────────────────────────
-- All other columns take their defaults (free-ship ₹999, flat ₹79, COD on,
-- banner/promo `{}`); the storefront then overlays code fallbacks for anything
-- blank. `store_name` is set explicitly because the column default still says
-- 'JR Jewellers' (historical) while the canonical brand is 'RJ Jewellers' (5.6).
insert into setting (id, store_name)
values (true, 'RJ Jewellers')
on conflict (id) do nothing;

-- ── 2. NOT seeded here (deploy-time manual steps) ─────────────────────────────
--
-- • First admin — can't be seeded: the account must exist in auth.users first,
--   and `admin_grant_role` (0005) can't bootstrap the FIRST admin (its
--   is_admin() gate needs an existing one). After the operator signs up
--   normally, stamp the role by hand (SQL editor):
--
--     update auth.users
--        set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--            || jsonb_build_object('role', 'admin', 'role_granted_at', now())
--      where email = '<operator email>';
--     insert into admin_role_audit (target_id, target_email, action, actor_email)
--     select id, email, 'grant', 'bootstrap'
--       from auth.users where email = '<operator email>';
--
-- • Cron secret — a SECRET, never committed. Generate (`openssl rand -hex 32`),
--   set it as the CRON_SECRET env var, and insert the same value (0029; the
--   daily digest + push sender both check it):
--
--     insert into app_secret (name, value) values ('cron', '<same value>');
--
-- • Catalog (products / categories / coupons) — intentionally empty; the
--   operator enters it through the admin console or the bulk .xlsx import.

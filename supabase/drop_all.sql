-- supabase/drop_all.sql — tears down everything 0001_initial_schema.sql builds.
--
-- ⚠️  DESTRUCTIVE AND IRREVERSIBLE. This drops all 18 tables with `cascade`;
--     every order, product, review and customer profile goes with them. There
--     is no undo. Intended for resetting a dev/staging database, or starting
--     over after a botched migration — not for routine use.
--
-- Because pasting the wrong tab into a production SQL editor is a real way to
-- lose a store, the script refuses to run until you ARM it. Two ways:
--
--   1. Anywhere (Supabase SQL editor included) — edit §0 below and change
--          v_confirm constant text := 'no';
--      to 'yes'. This always works.
--
--   2. psql only, for scripted resets — leave the file alone and pass the GUC:
--          psql "$DATABASE_URL" -c "set jr.confirm_drop='yes'" -f supabase/drop_all.sql
--
-- Option 2 is unreliable in the Supabase SQL editor and through Supavisor's
-- transaction pooler: they may run each statement on a different backend
-- connection, so a session-level `set` is not guaranteed to still be in effect
-- when the check below runs. If you armed it that way and still got
-- "the script is not armed", that is why — use option 1.
--
-- Afterwards the database is back to the state it was in before the migration,
-- so a clean rebuild is:
--
--     psql "$DATABASE_URL" -f supabase/migrations/0001_initial_schema.sql
--     psql "$DATABASE_URL" -f supabase/seed.sql
--     psql "$DATABASE_URL" -f supabase/seed_demo.sql   -- optional
--
-- Deliberately NOT touched:
--   • the `pgcrypto` extension — shared with the rest of the Supabase stack;
--   • `auth.users` and everything GoTrue owns — dropping accounts is a separate
--     decision, and §7 has the statement if you want it;
--   • the `supabase_realtime` publication itself — it predates this schema.
--     Dropping the tables removes them from it automatically.

begin;

-- ════════════════════════════════════════════════════════════════════════
-- 0. Safety catch
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ⚠️ CHANGE THIS TO 'yes' TO ARM THE SCRIPT. ⚠️
  v_confirm constant text := 'no';
begin
  -- Two ways to arm, because a session GUC is not reliable everywhere: the
  -- Supabase SQL editor and Supavisor's transaction pooling can put each
  -- statement on a different backend connection, so a `set` run beforehand may
  -- simply not be visible here. Editing the line above always works.
  if v_confirm <> 'yes'
     and coalesce(current_setting('jr.confirm_drop', true), '') <> 'yes' then
    raise exception 'Refusing to drop the schema — the script is not armed.'
      using hint =
        'Edit drop_all.sql §0 and set v_confirm := ''yes'', or (psql only) pass '
        '-c "set jr.confirm_drop=''yes''". This deletes every table and all data in them.';
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 1. Storage policies
-- ════════════════════════════════════════════════════════════════════════
-- These live on storage.objects — a table this schema does NOT own — so unlike
-- the policies on our own tables they do not disappear with a drop, and would
-- be left behind referencing a public.is_admin() that no longer exists.

drop policy if exists "product_images_public_read"   on storage.objects;
drop policy if exists "product_images_admin_insert"  on storage.objects;
drop policy if exists "product_images_admin_update"  on storage.objects;
drop policy if exists "product_images_admin_delete"  on storage.objects;
drop policy if exists "return_photos_owner_insert"   on storage.objects;
drop policy if exists "return_photos_owner_read"     on storage.objects;
drop policy if exists "return_photos_admin_delete"   on storage.objects;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Storage buckets and their contents
-- ════════════════════════════════════════════════════════════════════════
-- Objects first: storage.buckets is referenced by storage.objects, so the
-- bucket rows will not delete while files remain. This removes the DATABASE
-- records; the underlying files stay on disk (or in S3) until storage's own
-- cleanup runs.
--
-- Newer supabase/storage-api versions install a `storage.protect_delete()`
-- trigger that rejects direct DELETE on these tables with SQLSTATE 42501
-- ("Use the Storage API instead"). That is a deliberate guard against orphaned
-- objects, and it is not ours to disable — so this section ATTEMPTS the delete
-- and steps over the refusal instead of aborting the whole teardown.
--
-- If it is skipped, nothing downstream breaks: the migration recreates both
-- buckets with `on conflict do nothing`, so a rebuild is unaffected. Only the
-- stored files linger. Clear those from Studio → Storage, or via the API:
--   supabase.storage.from('product-images').remove([...])

do $$
declare
  v_objects int := 0;
  v_buckets int := 0;
begin
  begin
    delete from storage.objects where bucket_id in ('product-images', 'return-photos');
    get diagnostics v_objects = row_count;

    delete from storage.buckets where id in ('product-images', 'return-photos');
    get diagnostics v_buckets = row_count;

    raise notice 'storage: removed % object row(s) and % bucket row(s).', v_objects, v_buckets;
  exception
    when insufficient_privilege then
      -- 42501 from storage.protect_delete(). The sub-block rolls back on its
      -- own; the outer transaction carries on to the table drops below.
      raise notice
        'storage: direct deletes are blocked by storage.protect_delete() — buckets and files left in place. Clear them from Studio → Storage if you want them gone. Everything else still drops.';
  end;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Tables
-- ════════════════════════════════════════════════════════════════════════
-- `cascade` takes the foreign keys, indexes, triggers, RLS policies and the
-- product.search generated column with them, so order does not matter here.

drop table if exists public.return_request    cascade;
drop table if exists public.cart_snapshot     cascade;
drop table if exists public.push_subscription cascade;
drop table if exists public.app_secret        cascade;
drop table if exists public.admin_audit_log   cascade;
drop table if exists public.admin_role_audit  cascade;
drop table if exists public.subscriber        cascade;
drop table if exists public.contact_message   cascade;
drop table if exists public.coupon            cascade;
drop table if exists public.order_item        cascade;
drop table if exists public."order"           cascade;
drop table if exists public.customer_profile  cascade;
drop table if exists public.setting           cascade;
drop table if exists public.review            cascade;
drop table if exists public.product_option    cascade;
drop table if exists public.product_image     cascade;
drop table if exists public.product           cascade;
drop table if exists public.category          cascade;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Functions
-- ════════════════════════════════════════════════════════════════════════
-- Dropped by explicit name, never by "everything in public": on a self-hosted
-- stack pgcrypto may be installed in `public`, and a blanket drop would take
-- crypt()/gen_salt() with it and break password hashing.
--
-- Looping over pg_proc rather than listing signatures keeps this correct if a
-- function is ever overloaded — pg_get_function_identity_arguments rebuilds the
-- exact signature for each row.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'admin_add_order_note', 'admin_bulk_upsert_categories', 'admin_bulk_upsert_coupons',
        'admin_bulk_upsert_products', 'admin_delete_category', 'admin_delete_coupon',
        'admin_delete_push_subscription', 'admin_grant_role', 'admin_list_admins',
        'admin_remove_subscriber', 'admin_review_contact', 'admin_revoke_role',
        'admin_save_push_subscription', 'admin_set_message_status', 'admin_set_order_awb',
        'admin_set_order_status', 'admin_set_return_status', 'admin_set_review_status',
        'admin_toggle_coupon', 'admin_update_settings', 'admin_upsert_category',
        'admin_upsert_coupon', 'admin_upsert_product', 'customer_cancel_order',
        'customer_request_return', 'get_abandoned_carts', 'get_daily_digest',
        'get_order_confirmation', 'get_push_subscriptions', 'is_admin',
        'mark_carts_reminded', 'place_order', 'prune_push_subscriptions',
        'set_updated_at', 'submit_contact_message', 'submit_review', 'subscribe_email',
        'sync_cart', 'sync_product_primary_image', 'sync_product_rating', 'tg_admin_audit'
      ])
  loop
    execute format('drop function if exists %s cascade', fn.sig);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Sequences
-- ════════════════════════════════════════════════════════════════════════
-- Standalone (not owned by a column), so `drop table` does not remove them.
-- Leaving them behind would restart order numbers mid-range after a rebuild.

drop sequence if exists public.order_no_seq;
drop sequence if exists public.contact_message_no_seq;

commit;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Verify
-- ════════════════════════════════════════════════════════════════════════
-- The first three must be 0; anything left is something this file missed.
-- `buckets_left` is informational: it stays 2 when storage.protect_delete()
-- blocked §2, which is expected and harmless (the migration recreates them).

select
  (select count(*) from pg_tables     where schemaname = 'public')                    as tables_left,
  (select count(*) from pg_sequences  where schemaname = 'public')                    as sequences_left,
  (select count(*) from pg_policies   where tablename  = 'objects'
     and (policyname like 'product_images%' or policyname like 'return_photos%'))     as storage_policies_left,
  (select count(*) from storage.buckets where id in ('product-images','return-photos')) as buckets_left_ok_if_2;

-- ════════════════════════════════════════════════════════════════════════
-- 7. Optional — the accounts
-- ════════════════════════════════════════════════════════════════════════
-- auth.users is GoTrue's, not this schema's, so nothing above touches it. After
-- a drop those accounts still exist and can still sign in — they simply have no
-- profile or orders. To clear the ones the seed files create:
--
--   delete from auth.users where email = 'demo@rjjewellers.in';   -- seed_demo.sql
--   delete from auth.users where email = '<your admin address>';  -- seed.sql §4
--
-- Leaving the admin in place is usually what you want: re-running seed.sql then
-- re-asserts its role and keeps the password you already have.

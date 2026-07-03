-- 0006_admin_read_policies.sql — Admin READ access for the console (Phase 3.2)
--
-- The dashboard (and later admin list views) read order/order_item/review data.
-- Rather than a bypass-all service-role key in the app env, grant the admin
-- ROLE read access via RLS keyed on the JWT app_metadata claim: an admin's own
-- cookie session can read these tables; the anon/publishable key still cannot
-- (no claim), and customers keep their own-row policies. Writes stay RPC-only.

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- Admins read all orders + order items (customers keep their own-row policies;
-- RLS policies are OR'd, so these are purely additive).
drop policy if exists "order_admin_read" on "order";
create policy "order_admin_read" on "order"
  for select to authenticated using (public.is_admin());

drop policy if exists "order_item_admin_read" on order_item;
create policy "order_item_admin_read" on order_item
  for select to authenticated using (public.is_admin());

-- Admins read every review (the storefront still sees approved only).
drop policy if exists "review_admin_read" on review;
create policy "review_admin_read" on review
  for select to authenticated using (public.is_admin());

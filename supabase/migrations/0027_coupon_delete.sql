-- 0027_coupon_delete.sql
-- TASKS 5.9 — coupons could be created + toggled but never deleted; a mistaken
-- code was unremovable. Adds the admin-only delete path, mirroring
-- admin_delete_category (0011): SECURITY DEFINER, is_admin()-gated at runtime,
-- table stays RLS-sealed for writes. A hard delete is safe here — `coupon` has
-- no child rows, and orders store the applied code as plain text (`coupon_code`,
-- not a foreign key), so deleting a code never orphans an order.

create or replace function public.admin_delete_coupon(p_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  delete from coupon where id = p_id;
  if not found then
    raise exception 'COUPON_NOT_FOUND' using errcode = 'no_data_found';
  end if;
end;
$$;

grant execute on function public.admin_delete_coupon(uuid)
  to anon, authenticated, service_role;

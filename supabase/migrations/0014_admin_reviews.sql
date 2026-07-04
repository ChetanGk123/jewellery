-- 0014_admin_reviews.sql — TASKS 3.7 Reviews moderation
--
-- The `review` table + its read policies already exist (public reads approved,
-- admins read all via 0006 `review_admin_read`). The only missing piece for the
-- admin console is a WRITE path: moderators flip a review's status. As with
-- every other admin mutation, that goes through a SECURITY DEFINER RPC gated on
-- is_admin() rather than a table write — the table stays RLS-sealed for writes
-- (no write policy, no service-role key).

create or replace function public.admin_set_review_status(
  p_id     uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  -- Mirror the table's own status check so a bad value fails with a clear code
  -- instead of a raw constraint violation.
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'INVALID_STATUS: %', p_status using errcode = 'check_violation';
  end if;

  update review set status = p_status where id = p_id;
  if not found then
    raise exception 'REVIEW_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  return p_status;
end;
$$;

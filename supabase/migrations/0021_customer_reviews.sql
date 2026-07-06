-- 0021_customer_reviews.sql — TASKS 4.15 (Phase 4 production-readiness audit)
--
-- Customers can't submit reviews at all today — the moderation console (0014)
-- only ever has seed rows to moderate (STOREFRONT_SHORTFALLS.md 2.6). This
-- adds the write path: a signed-in customer submits a review, it lands as
-- `pending`, and the existing admin queue moderates it exactly like a seed row.
--
-- `review` predates customer auth (no user_id), so:
--   1. Add a nullable `user_id` (existing seed rows keep it null — unaffected).
--   2. One review per product per customer, enforced by a partial unique index
--      (only applies to real customer submissions, not the null-user_id seed rows).
--   3. submit_review: the only write path (mirrors place_order/customer_cancel_order
--      — SECURITY DEFINER, auth.uid() gate, revoke-all-then-grant-authenticated).

alter table review add column user_id uuid references auth.users (id);

create unique index review_product_user_uniq
  on review (product_id, user_id)
  where user_id is not null;

create or replace function public.submit_review(
  p_product_id uuid,
  p_rating     integer,
  p_title      text,
  p_body       text,
  p_name       text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_id      uuid;
  v_name    text;
  v_title   text;
  v_body    text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from product where id = p_product_id) then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING' using errcode = 'check_violation';
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  v_body := nullif(btrim(coalesce(p_body, '')), '');
  v_title := nullif(btrim(coalesce(p_title, '')), '');
  if v_name is null or v_body is null or length(v_body) < 10 then
    raise exception 'INVALID_INPUT' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from review
    where product_id = p_product_id and user_id = v_user_id
  ) then
    raise exception 'ALREADY_REVIEWED' using errcode = 'unique_violation';
  end if;

  insert into review (product_id, user_id, name, rating, title, body, status)
  values (p_product_id, v_user_id, v_name, p_rating, v_title, v_body, 'pending')
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$$;

revoke all on function public.submit_review(uuid, integer, text, text, text) from public;
grant execute on function public.submit_review(uuid, integer, text, text, text) to authenticated;

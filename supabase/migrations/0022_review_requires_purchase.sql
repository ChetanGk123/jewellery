-- 0022_review_requires_purchase.sql — TASKS 4.15 follow-up
--
-- submit_review (0021) let any signed-in customer review any product,
-- purchased or not — no "Verified Purchase" trust signal (user decision:
-- require a Delivered order). Adds a purchase check between the
-- product-exists and rating checks; everything else about the function is
-- unchanged.

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

  if not exists (
    select 1
      from "order" o
      join order_item oi on oi.order_id = o.id
     where o.user_id = v_user_id
       and oi.product_id = p_product_id
       and o.status = 'Delivered'
  ) then
    raise exception 'PURCHASE_REQUIRED' using errcode = 'insufficient_privilege';
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

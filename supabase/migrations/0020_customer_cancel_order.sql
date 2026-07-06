-- 0020_customer_cancel_order.sql — TASKS 4.14 (Phase 4 production-readiness audit)
--
-- Customers can't cancel their own order at all today — only the admin
-- console can (admin_set_order_status, 0007/0019). For a COD store, a
-- customer who changes their mind before an order ships currently has no
-- self-serve path (STOREFRONT_SHORTFALLS.md 2.5).
--
-- customer_cancel_order mirrors admin_set_order_status's Cancel branch
-- (release the coupon use, restore stock) but is scoped tighter:
--   * looked up by order_no + user_id = auth.uid() (never trust a client id)
--   * only from Pending — customers don't get admin's wider "any
--     non-terminal state" allowance, since Confirmed+ means the store has
--     already started fulfilling it.

create or replace function public.customer_cancel_order(p_order_no text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_order_id uuid;
  v_status   text;
  v_coupon   text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  select id, status, coupon_code into v_order_id, v_status, v_coupon
    from "order"
   where order_no = p_order_no
     and user_id = v_user_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if v_status <> 'Pending' then
    raise exception 'ORDER_NOT_CANCELLABLE: %', v_status using errcode = 'check_violation';
  end if;

  update "order" set status = 'Cancelled' where id = v_order_id;

  if v_coupon is not null then
    update coupon set usage_count = greatest(0, usage_count - 1) where code = v_coupon;
  end if;

  update product p
     set stock = p.stock + oi.qty
    from order_item oi
   where oi.order_id = v_order_id
     and p.id = oi.product_id;

  return 'Cancelled';
end;
$$;

revoke all on function public.customer_cancel_order(text) from public;
grant execute on function public.customer_cancel_order(text) to authenticated;

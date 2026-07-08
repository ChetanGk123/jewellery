-- 0033_backward_clears_awb.sql
-- 6.4d (user request): a backward status move clears the recorded AWB +
-- tracking link. Moving back means the forward step was a mis-click, so the
-- courier details recorded for that stage are stale — keeping them would let
-- an order re-advance to Delivered against a booking that may have been
-- cancelled. Re-shipping means re-entering the (new) AWB deliberately.
--
-- Only the final transition update changes vs 0031/0032; everything else is
-- the same body re-stated (create or replace).

create or replace function public.admin_set_order_status(
  p_order_id uuid,
  p_status   text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flow    text[] := array['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered'];
  v_current text;
  v_coupon  text;
  v_awb     text;
  v_ci      int;
  v_ni      int;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  select status, coupon_code, awb into v_current, v_coupon, v_awb
    from "order" where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Terminal states never change.
  if v_current in ('Delivered', 'Cancelled') then
    raise exception 'ORDER_TERMINAL: %', v_current using errcode = 'check_violation';
  end if;

  -- Cancel is reachable from any non-terminal state. Release the coupon use and
  -- restore stock so a cancelled COD order doesn't permanently burn a limited
  -- code or leave stock short (cancel is terminal, so this runs at most once).
  if p_status = 'Cancelled' then
    update "order" set status = 'Cancelled' where id = p_order_id;
    if v_coupon is not null then
      update coupon set usage_count = greatest(0, usage_count - 1) where code = v_coupon;
    end if;
    update product p
       set stock = p.stock + oi.qty
      from order_item oi
     where oi.order_id = p_order_id
       and p.id = oi.product_id;
    return 'Cancelled';
  end if;

  -- No delivery without a tracking number on file (6.4).
  if p_status = 'Delivered' and (v_awb is null or btrim(v_awb) = '') then
    raise exception 'AWB_REQUIRED' using errcode = 'check_violation';
  end if;

  -- One step forward, or one step back to undo a mis-click (6.5).
  v_ci := array_position(v_flow, v_current);
  v_ni := array_position(v_flow, p_status);
  if v_ni is null or (v_ni <> v_ci + 1 and v_ni <> v_ci - 1) then
    raise exception 'INVALID_TRANSITION: % -> %', v_current, p_status
      using errcode = 'check_violation';
  end if;

  -- A backward step invalidates the recorded courier details (6.4d).
  update "order"
     set status       = p_status,
         awb          = case when v_ni = v_ci - 1 then null else awb end,
         tracking_url = case when v_ni = v_ci - 1 then null else tracking_url end
   where id = p_order_id;
  return p_status;
end;
$$;

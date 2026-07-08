-- 0031_awb_and_backward_status.sql
-- 6.4 + 6.5: manual AWB entry + one-step backward status moves.
--
-- 6.4: Shiprocket integration stays deferred — couriers are booked outside
-- the app, so the operator records the AWB (air waybill / tracking number)
-- by hand once a parcel is booked. Delivering with no tracking number on
-- file is the failure mode being closed: moving to Delivered now requires a
-- saved AWB.
--
-- 6.5: mis-clicks happen (Confirmed too early, Packed on the wrong order).
-- `admin_set_order_status` (0007/0019) was strictly forward-only; it now also
-- allows exactly one step backward along the flow while the order isn't
-- terminal. Delivered/Cancelled stay final, and Cancel keeps its own branch
-- (coupon release + stock restore) unchanged.

-- ── admin_set_order_awb ───────────────────────────────────────────────────────
-- Mirrors lib/admin/awb.ts: trimmed, 1–40 chars, alphanumeric with common
-- courier separators, must start alphanumeric.
create or replace function public.admin_set_order_awb(
  p_order_id uuid,
  p_awb      text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awb     text;
  v_current text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  v_awb := btrim(coalesce(p_awb, ''));
  if v_awb = '' or length(v_awb) > 40 or v_awb !~ '^[A-Za-z0-9][A-Za-z0-9 /_-]*$' then
    raise exception 'INVALID_AWB' using errcode = 'check_violation';
  end if;

  select status into v_current from "order" where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Terminal orders are read-only history.
  if v_current in ('Delivered', 'Cancelled') then
    raise exception 'ORDER_TERMINAL: %', v_current using errcode = 'check_violation';
  end if;

  update "order" set awb = v_awb where id = p_order_id;
  return v_awb;
end;
$$;

revoke all on function public.admin_set_order_awb(uuid, text) from public;
grant execute on function public.admin_set_order_awb(uuid, text) to authenticated;

-- ── admin_set_order_status: AWB gate + one-step backward ─────────────────────
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

  update "order" set status = p_status where id = p_order_id;
  return p_status;
end;
$$;

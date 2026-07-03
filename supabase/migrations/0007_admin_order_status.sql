-- 0007_admin_order_status.sql — Admin order-status writes (Phase 3.3)
--
-- The `order` table is RLS-sealed for writes (0001): only SECURITY DEFINER
-- functions may mutate it. This adds the admin fulfilment write path — a single
-- RPC that advances an order one step along the fulfilment flow, or cancels it.
--
-- Authorisation is enforced *inside* the function via is_admin() (0006, the JWT
-- app_metadata.role claim), so an admin's own cookie session can call it with no
-- service-role key, while the anon/publishable key (no claim) is rejected.
--
-- Transition rules (mirrored in lib/admin/order-status.ts for the UI):
--   * forward by exactly one: Pending → Confirmed → Packed → Shipped → Delivered
--   * Cancelled: allowed from any non-terminal state
--   * Delivered and Cancelled are terminal — no further changes

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
  v_ci      int;
  v_ni      int;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  select status into v_current from "order" where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Terminal states never change.
  if v_current in ('Delivered', 'Cancelled') then
    raise exception 'ORDER_TERMINAL: %', v_current using errcode = 'check_violation';
  end if;

  -- Cancel is reachable from any non-terminal state.
  if p_status = 'Cancelled' then
    update "order" set status = 'Cancelled' where id = p_order_id;
    return 'Cancelled';
  end if;

  -- Otherwise only a single forward step is allowed.
  v_ci := array_position(v_flow, v_current);
  v_ni := array_position(v_flow, p_status);
  if v_ni is null or v_ni <> v_ci + 1 then
    raise exception 'INVALID_TRANSITION: % -> %', v_current, p_status
      using errcode = 'check_violation';
  end if;

  update "order" set status = p_status where id = p_order_id;
  return p_status;
end;
$$;

-- Sealed table stays sealed; only authenticated admins may call the function
-- (the is_admin() guard rejects non-admins at runtime).
revoke all on function public.admin_set_order_status(uuid, text) from public;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;

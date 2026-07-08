-- 0032_tracking_url.sql
-- 6.4c (user request): an optional courier tracking LINK next to the AWB, so
-- the storefront can render the AWB number as a clickable "track my parcel"
-- anchor. The courier varies per shipment (no integration yet), so the
-- operator pastes whatever tracking page the courier gave them.
--
-- `admin_set_order_awb` (0031) grows a third parameter; the two-arg overload
-- is dropped so PostgREST rpc resolution stays unambiguous. Passing a blank
-- p_tracking_url clears the stored link (an AWB without a link is fine — the
-- storefront then shows plain text).

alter table "order" add column if not exists tracking_url text;

drop function if exists public.admin_set_order_awb(uuid, text);

create or replace function public.admin_set_order_awb(
  p_order_id     uuid,
  p_awb          text,
  p_tracking_url text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awb     text;
  v_url     text;
  v_current text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  v_awb := btrim(coalesce(p_awb, ''));
  if v_awb = '' or length(v_awb) > 40 or v_awb !~ '^[A-Za-z0-9][A-Za-z0-9 /_-]*$' then
    raise exception 'INVALID_AWB' using errcode = 'check_violation';
  end if;

  -- Blank clears; otherwise http(s) only — this renders as a customer-facing
  -- link, so javascript:/data: must never be storable.
  v_url := btrim(coalesce(p_tracking_url, ''));
  if v_url = '' then
    v_url := null;
  elsif length(v_url) > 300 or v_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'INVALID_TRACKING_URL' using errcode = 'check_violation';
  end if;

  select status into v_current from "order" where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Terminal orders are read-only history.
  if v_current in ('Delivered', 'Cancelled') then
    raise exception 'ORDER_TERMINAL: %', v_current using errcode = 'check_violation';
  end if;

  update "order" set awb = v_awb, tracking_url = v_url where id = p_order_id;
  return v_awb;
end;
$$;

revoke all on function public.admin_set_order_awb(uuid, text, text) from public;
grant execute on function public.admin_set_order_awb(uuid, text, text) to authenticated;

-- 0043_return_requests.sql — TASKS 8.7a (returns & COD reconciliation)
--
-- Operator decisions (2026-07-10): return window and return-shipping payer are
-- settings-driven (`setting.returns` jsonb: {window_days, shipping_payer};
-- window_days 0 disables returns); settlement is refund-by-UPI OR exchange
-- (picked by the customer at request time); photos are REQUIRED (1–3).
--
-- Returns live in a sibling `return_request` table — one per order (v1) — so
-- the fulfilment status machine (0007/0031/0033) stays untouched and Delivered
-- stays terminal. Return flow: Requested → Approved → Received → Refunded or
-- Exchanged, with Rejected reachable only from Requested. All writes go
-- through RPCs (RLS row policies are read-only), matching every other write
-- path in the app.
--
-- Pieces:
--  1. `order.delivered_at` — the return window anchors on WHEN the order was
--     delivered, which was never recorded. `admin_set_order_status` (restated
--     from 0033) now stamps it on the move to Delivered; existing Delivered
--     rows are backfilled from `created_at` (a conservative, shorter window —
--     the operator can still approve outside the window by hand… by which we
--     mean: the window only gates the CUSTOMER's self-serve request).
--  2. `setting.returns` jsonb + `admin_update_settings` restated from 0042
--     with a `returns` branch (whole-replace like banner — the form sends the
--     complete object).
--  3. `return_request` table + RLS (customer reads own rows, admin reads all).
--  4. Private `return-photos` storage bucket — customers upload evidence into
--     their own `{uid}/…` folder; only the owner and admins can read. Files
--     are served via short-lived signed URLs, never public.
--  5. `customer_request_return` / `admin_set_return_status` RPCs.
--
-- Deliberately NOT here: automatic stock restore on a received return — the
-- operator inspects the piece and restocks sellable items by hand (Products).

-- ── 1. delivered_at ───────────────────────────────────────────────────────────

alter table "order" add column if not exists delivered_at timestamptz;

update "order" set delivered_at = created_at
 where status = 'Delivered' and delivered_at is null;

-- Restated from 0033; only the final transition update changes (stamp
-- delivered_at on the forward move to Delivered). Delivered is terminal, so
-- the stamp can never need clearing by a backward move.
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

  -- A backward step invalidates the recorded courier details (6.4d); the
  -- forward move to Delivered anchors the return window (8.7a).
  update "order"
     set status       = p_status,
         awb          = case when v_ni = v_ci - 1 then null else awb end,
         tracking_url = case when v_ni = v_ci - 1 then null else tracking_url end,
         delivered_at = case when p_status = 'Delivered' then now() else delivered_at end
   where id = p_order_id;
  return p_status;
end;
$$;

-- ── 2. setting.returns + admin_update_settings ───────────────────────────────

alter table setting add column if not exists returns jsonb not null default '{}'::jsonb;

-- Restated from 0042; only the `returns` branch is new (whole-replace like
-- banner/homepage_promo — the Settings form sends the complete object).
create or replace function public.admin_update_settings(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_PAYLOAD' using errcode = 'check_violation';
  end if;

  update setting set
    store_name =
      case when p_payload ? 'store_name'
        then coalesce(nullif(left(btrim(p_payload->>'store_name'), 120), ''), store_name)
        else store_name end,
    support_email =
      case when p_payload ? 'support_email'
        then nullif(left(btrim(coalesce(p_payload->>'support_email', '')), 160), '')
        else support_email end,
    phone =
      case when p_payload ? 'phone'
        then nullif(left(btrim(coalesce(p_payload->>'phone', '')), 40), '')
        else phone end,
    gstin =
      case when p_payload ? 'gstin'
        then nullif(upper(left(btrim(coalesce(p_payload->>'gstin', '')), 20)), '')
        else gstin end,
    free_ship_threshold_paise =
      case when p_payload ? 'free_ship_threshold_paise'
        then greatest(0, coalesce((p_payload->>'free_ship_threshold_paise')::int, free_ship_threshold_paise))
        else free_ship_threshold_paise end,
    flat_rate_paise =
      case when p_payload ? 'flat_rate_paise'
        then greatest(0, coalesce((p_payload->>'flat_rate_paise')::int, flat_rate_paise))
        else flat_rate_paise end,
    cod_enabled =
      case when p_payload ? 'cod_enabled'
        then coalesce((p_payload->>'cod_enabled')::boolean, cod_enabled)
        else cod_enabled end,
    banner =
      case when p_payload ? 'banner' then p_payload->'banner' else banner end,
    homepage_promo =
      case when p_payload ? 'homepage_promo' then p_payload->'homepage_promo' else homepage_promo end,
    store_info =
      case when p_payload ? 'store_info'
        then coalesce(store_info, '{}'::jsonb) || (p_payload->'store_info')
        else store_info end,
    email_copy =
      case when p_payload ? 'email_copy'
        then coalesce(email_copy, '{}'::jsonb) || (p_payload->'email_copy')
        else email_copy end,
    returns =
      case when p_payload ? 'returns' then p_payload->'returns' else returns end,
    updated_at = now()
  where id = true;

  if not found then
    raise exception 'SETTINGS_ROW_MISSING' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_update_settings(jsonb) to authenticated;

-- ── 3. return_request ─────────────────────────────────────────────────────────

create table if not exists return_request (
  id                  uuid primary key default gen_random_uuid(),
  -- One return per order (v1): whole-order returns only, no per-item splits.
  order_id            uuid not null unique references "order"(id) on delete cascade,
  user_id             uuid not null references auth.users(id),
  status              text not null default 'Requested'
                        check (status in ('Requested','Approved','Received','Refunded','Exchanged','Rejected')),
  reason              text not null check (length(btrim(reason)) between 1 and 1000),
  -- What the customer asked for. The operator may still settle a 'refund'
  -- request as an exchange (or vice versa) after talking to them.
  resolution          text not null check (resolution in ('refund','exchange')),
  -- Required iff the customer asked for a refund — COD has no card to reverse,
  -- so the payout is a manual UPI transfer to this VPA.
  upi_id              text check (resolution <> 'refund' or upi_id is not null),
  -- Storage paths in the private `return-photos` bucket ({uid}/…), required.
  photos              text[] not null check (array_length(photos, 1) between 1 and 3),
  -- Filled by the Refunded transition: what was actually paid back + the UPI
  -- transaction reference (UTR) — the record that makes COD cash reconcile.
  refund_amount_paise integer check (refund_amount_paise is null or refund_amount_paise >= 0),
  refund_reference    text,
  admin_note          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  resolved_at         timestamptz
);

create index if not exists return_request_status_idx on return_request (status, created_at desc);
create index if not exists return_request_user_id_idx on return_request (user_id, created_at desc);

drop trigger if exists return_request_set_updated_at on return_request;
create trigger return_request_set_updated_at before update on return_request
  for each row execute function public.set_updated_at();

alter table return_request enable row level security;

-- Reads only; every write goes through the RPCs below.
drop policy if exists "customer reads own return requests" on return_request;
create policy "customer reads own return requests"
  on return_request for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "admin reads return requests" on return_request;
create policy "admin reads return requests"
  on return_request for select
  to authenticated
  using (public.is_admin());

-- ── 4. return-photos storage (private) ───────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('return-photos', 'return-photos', false)
on conflict (id) do nothing;

-- Customers upload into their own {uid}/… folder only.
drop policy if exists "return_photos_owner_insert" on storage.objects;
create policy "return_photos_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'return-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- The owner and admins can read (signed URLs are minted server-side under
-- these same policies via the cookie session).
drop policy if exists "return_photos_owner_read" on storage.objects;
create policy "return_photos_owner_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'return-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
  );

-- Evidence is immutable for customers; admins may prune.
drop policy if exists "return_photos_admin_delete" on storage.objects;
create policy "return_photos_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'return-photos' and public.is_admin());

-- ── 5a. customer_request_return ───────────────────────────────────────────────
-- The customer's one write path. Mirrors customer_cancel_order's scoping
-- (order_no + auth.uid(), never a client-supplied id) and enforces every
-- product decision server-side: Delivered only, inside the settings window,
-- one request per order, 1–3 photos from the caller's own folder, and a
-- plausible UPI VPA when the ask is a refund.

create or replace function public.customer_request_return(
  p_order_no   text,
  p_reason     text,
  p_resolution text,
  p_upi_id     text default null,
  p_photos     text[] default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid;
  v_order_id     uuid;
  v_status       text;
  v_delivered_at timestamptz;
  v_window_days  integer;
  v_reason       text;
  v_upi          text;
  v_photo        text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  -- Settings-driven window; 0 (or an unset/broken blob) means returns are off.
  select coalesce(nullif(btrim(returns->>'window_days'), '')::int, 7)
    into v_window_days from setting limit 1;
  v_window_days := coalesce(v_window_days, 7);
  if v_window_days <= 0 then
    raise exception 'RETURNS_DISABLED' using errcode = 'check_violation';
  end if;

  select id, status, delivered_at into v_order_id, v_status, v_delivered_at
    from "order"
   where order_no = p_order_no
     and user_id = v_user_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if v_status <> 'Delivered' then
    raise exception 'ORDER_NOT_RETURNABLE: %', v_status using errcode = 'check_violation';
  end if;

  -- Pre-0043 Delivered rows have delivered_at backfilled from created_at, so
  -- this is never null for a Delivered order; guard anyway.
  if now() > coalesce(v_delivered_at, now()) + make_interval(days => v_window_days) then
    raise exception 'RETURN_WINDOW_CLOSED' using errcode = 'check_violation';
  end if;

  if exists (select 1 from return_request where order_id = v_order_id) then
    raise exception 'RETURN_EXISTS' using errcode = 'unique_violation';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if v_reason = '' or length(v_reason) > 1000 then
    raise exception 'INVALID_REASON' using errcode = 'check_violation';
  end if;

  if p_resolution not in ('refund', 'exchange') then
    raise exception 'INVALID_RESOLUTION' using errcode = 'check_violation';
  end if;

  -- COD refunds are manual UPI payouts — a refund ask must carry a VPA.
  v_upi := lower(btrim(coalesce(p_upi_id, '')));
  if p_resolution = 'refund' then
    if v_upi !~ '^[a-z0-9][a-z0-9._-]{1,255}@[a-z]{2,64}$' then
      raise exception 'INVALID_UPI' using errcode = 'check_violation';
    end if;
  else
    v_upi := null;
  end if;

  if p_photos is null or array_length(p_photos, 1) is null
     or array_length(p_photos, 1) < 1 or array_length(p_photos, 1) > 3 then
    raise exception 'PHOTOS_REQUIRED' using errcode = 'check_violation';
  end if;
  -- Paths must live in the caller's own folder of the return-photos bucket —
  -- a forged path can't point at someone else's upload.
  foreach v_photo in array p_photos loop
    if v_photo not like (v_user_id::text || '/%') then
      raise exception 'INVALID_PHOTO_PATH' using errcode = 'check_violation';
    end if;
  end loop;

  insert into return_request (order_id, user_id, reason, resolution, upi_id, photos)
  values (v_order_id, v_user_id, v_reason, p_resolution, v_upi, p_photos);

  return 'Requested';
end;
$$;

revoke all on function public.customer_request_return(text, text, text, text, text[]) from public;
grant execute on function public.customer_request_return(text, text, text, text, text[]) to authenticated;

-- ── 5b. admin_set_return_status ───────────────────────────────────────────────
-- Legal transitions only:
--   Requested → Approved | Rejected
--   Approved  → Received
--   Received  → Refunded | Exchanged   (either, regardless of the customer's
--                                       original ask — settled in conversation)
-- Refunded requires the paid amount + UPI reference (UTR) and marks the order
-- payment_status = 'refunded' so COD reconciliation sees it. Refunded /
-- Exchanged / Rejected are terminal. An optional admin note can ride any
-- transition.

create or replace function public.admin_set_return_status(
  p_return_id           uuid,
  p_status              text,
  p_refund_amount_paise integer default null,
  p_refund_reference    text default null,
  p_admin_note          text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current  text;
  v_order_id uuid;
  v_ref      text;
  v_note     text;
  v_terminal boolean;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  select status, order_id into v_current, v_order_id
    from return_request where id = p_return_id;
  if not found then
    raise exception 'RETURN_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not (
       (v_current = 'Requested' and p_status in ('Approved', 'Rejected'))
    or (v_current = 'Approved'  and p_status = 'Received')
    or (v_current = 'Received'  and p_status in ('Refunded', 'Exchanged'))
  ) then
    raise exception 'INVALID_RETURN_TRANSITION: % -> %', v_current, coalesce(p_status, '?')
      using errcode = 'check_violation';
  end if;

  v_note := nullif(left(btrim(coalesce(p_admin_note, '')), 500), '');
  v_terminal := p_status in ('Refunded', 'Exchanged', 'Rejected');

  if p_status = 'Refunded' then
    v_ref := nullif(left(btrim(coalesce(p_refund_reference, '')), 60), '');
    if p_refund_amount_paise is null or p_refund_amount_paise <= 0 or v_ref is null then
      raise exception 'REFUND_DETAILS_REQUIRED' using errcode = 'check_violation';
    end if;

    update return_request
       set status              = 'Refunded',
           refund_amount_paise = p_refund_amount_paise,
           refund_reference    = v_ref,
           admin_note          = coalesce(v_note, admin_note),
           resolved_at         = now()
     where id = p_return_id;

    -- The COD cash for this order is no longer (fully) held — reconciliation
    -- reads this flag plus the refund columns above.
    update "order" set payment_status = 'refunded' where id = v_order_id;
    return 'Refunded';
  end if;

  update return_request
     set status      = p_status,
         admin_note  = coalesce(v_note, admin_note),
         resolved_at = case when v_terminal then now() else resolved_at end
   where id = p_return_id;
  return p_status;
end;
$$;

revoke all on function public.admin_set_return_status(uuid, text, integer, text, text) from public;
grant execute on function public.admin_set_return_status(uuid, text, integer, text, text) to authenticated;

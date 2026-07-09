-- 0036_store_info.sql — TASKS 6.15 (settings-driven store info)
--
-- The store's identity/contact (name, support email, phone, GSTIN) is already
-- editable via the scalar `setting` columns (3.11). The RICHER brand/contact
-- fields that only lived in the `STORE_INFO` const (descriptor, tagline,
-- address, opening hours, WhatsApp number, socials) get a home here as a
-- single free-form `store_info` jsonb blob — same pattern as `banner` /
-- `homepage_promo`. `getStoreInfo()` merges this (+ the scalar columns) over
-- the const, so anything unset/blank keeps the const value.
--
-- Only `admin_update_settings` changes vs 0018: it now writes `store_info`
-- when the payload carries that key. Unlike banner/promo (whole-replace),
-- store_info is SHALLOW-MERGED (`||`) so a partial payload updates only the
-- keys it sends and preserves the rest (e.g. `wordmark`/`socials`, which the
-- Settings UI doesn't edit yet). The form always sends complete nested
-- `address`/`hours` objects, so replacing those top-level keys is correct.

alter table setting add column if not exists store_info jsonb not null default '{}'::jsonb;

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
    updated_at = now()
  where id = true;

  if not found then
    raise exception 'SETTINGS_ROW_MISSING' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_update_settings(jsonb) to authenticated;

-- 0044_homepage_hero.sql — TASKS 9.2 (settings-managed homepage hero image)
--
-- The storefront hero's photo card becomes operator-managed: the uploaded
-- image's public URL lives in a `homepage_hero` jsonb blob ({image_url}) on
-- the `setting` singleton, so future hero fields (headline, CTA…) can ride
-- the same key. `resolveHeroSettings()` (lib/homepage-hero.ts) reads it
-- tolerantly; an empty/missing url keeps the code's placeholder card.
--
-- Only `admin_update_settings` changes vs 0043: a `homepage_hero` branch,
-- WHOLE-REPLACE like banner/homepage_promo (the Settings form sends the
-- complete object).

alter table setting add column if not exists homepage_hero jsonb not null default '{}'::jsonb;

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
    homepage_hero =
      case when p_payload ? 'homepage_hero' then p_payload->'homepage_hero' else homepage_hero end,
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

-- 0035_category_images.sql
-- 6.11: real category photos. `category` gains an optional image_url that the
-- admin sets from the category modal (uploaded to the product-images bucket
-- under categories/ — same is_admin()-gated Storage policy from 0010). The
-- storefront's "Shop by Category" tiles prefer the photo and keep the
-- hero_bg gradient as the fallback, so nothing changes until a photo is set.
--
-- admin_upsert_category (0011) is re-stated with image_url handling in both
-- branches; blank clears, non-blank must be an http(s) URL (it renders as a
-- customer-facing background image).

alter table category add column if not exists image_url text;

create or replace function public.admin_upsert_category(
  p_id      uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_base  text;
  v_slug  text;
  v_name  text := btrim(p_payload->>'name');
  v_desc  text := nullif(btrim(p_payload->>'description'), '');
  v_image text := nullif(btrim(coalesce(p_payload->>'image_url', '')), '');
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if coalesce(v_name, '') = '' then
    raise exception 'NAME_REQUIRED' using errcode = 'check_violation';
  end if;

  if v_image is not null
     and (length(v_image) > 500 or v_image !~* '^https?://[^[:space:]]+$') then
    raise exception 'INVALID_IMAGE_URL' using errcode = 'check_violation';
  end if;

  if p_id is null then
    -- Slugify the name, then de-dupe with a numeric suffix.
    v_base := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
    if v_base = '' then v_base := 'category'; end if;
    v_slug := v_base;
    while exists (select 1 from category where slug = v_slug) loop
      v_slug := v_base || '-' || floor(random() * 9000 + 1000)::int::text;
    end loop;

    insert into category (name, slug, description, image_url, sort_order)
    values (
      v_name,
      v_slug,
      v_desc,
      v_image,
      coalesce((select max(sort_order) from category), 0) + 1
    )
    returning id into v_id;
  else
    update category set
      name        = v_name,
      description = v_desc,
      image_url   = v_image
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'CATEGORY_NOT_FOUND' using errcode = 'no_data_found';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_category(uuid, jsonb) from public;
grant execute on function public.admin_upsert_category(uuid, jsonb) to authenticated;

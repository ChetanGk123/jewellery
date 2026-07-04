-- 0009_admin_product_media.sql — Product gallery + plating options (Phase 3.4)
--
-- The redesigned add/edit product dialog (mirroring JR Admin Dashboard.html)
-- has a multi-image "Designs & images" grid and "Plating options" chips. The
-- product table only had a single `primary_image_url`, so this adds:
--   * gallery         — ordered list of {url, name, primary} image variants.
--                       primary_image_url stays the denormalised storefront
--                       thumbnail (= the primary variant's url).
--   * plating_options — finishes a customer can choose (Gold tone, etc.).
--
-- Both are additive with safe defaults, so existing rows and the storefront are
-- unaffected. admin_upsert_product (0008) is re-emitted to persist them; the
-- signature is unchanged so callers and grants stay valid.

alter table public.product
  add column if not exists gallery jsonb not null default '[]'::jsonb;

alter table public.product
  add column if not exists plating_options text[] not null default '{}';

create or replace function public.admin_upsert_product(
  p_id      uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_base     text;
  v_slug     text;
  v_gallery  jsonb   := coalesce(p_payload->'gallery', '[]'::jsonb);
  v_plating  text[]  := coalesce(
                          array(select jsonb_array_elements_text(
                            coalesce(p_payload->'plating_options', '[]'::jsonb))),
                          '{}');
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if coalesce(btrim(p_payload->>'name'), '') = '' then
    raise exception 'NAME_REQUIRED' using errcode = 'check_violation';
  end if;
  if coalesce(btrim(p_payload->>'sku'), '') = '' then
    raise exception 'SKU_REQUIRED' using errcode = 'check_violation';
  end if;
  if p_payload->>'category_id' is null then
    raise exception 'CATEGORY_REQUIRED' using errcode = 'check_violation';
  end if;

  if p_id is null then
    -- Slugify the name, then de-dupe with a numeric suffix.
    v_base := btrim(regexp_replace(lower(btrim(p_payload->>'name')), '[^a-z0-9]+', '-', 'g'), '-');
    if v_base = '' then v_base := 'product'; end if;
    v_slug := v_base;
    while exists (select 1 from product where slug = v_slug) loop
      v_slug := v_base || '-' || floor(random() * 9000 + 1000)::int::text;
    end loop;

    insert into product (
      name, sku, slug, category_id, price_paise, mrp_paise, stock, status,
      primary_image_url, gallery, plating_options, material, badge, blurb, desc_long,
      details_plating, details_stones, details_care, shipping_note,
      is_featured, is_fresh
    ) values (
      btrim(p_payload->>'name'), btrim(p_payload->>'sku'), v_slug,
      (p_payload->>'category_id')::uuid,
      (p_payload->>'price_paise')::int,
      nullif(p_payload->>'mrp_paise', '')::int,
      coalesce((p_payload->>'stock')::int, 0),
      coalesce(nullif(p_payload->>'status', ''), 'Active'),
      nullif(p_payload->>'primary_image_url', ''),
      v_gallery,
      v_plating,
      nullif(p_payload->>'material', ''),
      coalesce(nullif(p_payload->>'badge', ''), 'None'),
      nullif(p_payload->>'blurb', ''),
      nullif(p_payload->>'desc_long', ''),
      nullif(p_payload->>'details_plating', ''),
      nullif(p_payload->>'details_stones', ''),
      nullif(p_payload->>'details_care', ''),
      nullif(p_payload->>'shipping_note', ''),
      coalesce((p_payload->>'is_featured')::boolean, false),
      coalesce((p_payload->>'is_fresh')::boolean, false)
    )
    returning id into v_id;
  else
    update product set
      name              = btrim(p_payload->>'name'),
      sku               = btrim(p_payload->>'sku'),
      category_id       = (p_payload->>'category_id')::uuid,
      price_paise       = (p_payload->>'price_paise')::int,
      mrp_paise         = nullif(p_payload->>'mrp_paise', '')::int,
      stock             = coalesce((p_payload->>'stock')::int, 0),
      status            = coalesce(nullif(p_payload->>'status', ''), 'Active'),
      primary_image_url = nullif(p_payload->>'primary_image_url', ''),
      gallery           = v_gallery,
      plating_options   = v_plating,
      material          = nullif(p_payload->>'material', ''),
      badge             = coalesce(nullif(p_payload->>'badge', ''), 'None'),
      blurb             = nullif(p_payload->>'blurb', ''),
      desc_long         = nullif(p_payload->>'desc_long', ''),
      details_plating   = nullif(p_payload->>'details_plating', ''),
      details_stones    = nullif(p_payload->>'details_stones', ''),
      details_care      = nullif(p_payload->>'details_care', ''),
      shipping_note     = nullif(p_payload->>'shipping_note', ''),
      is_featured       = coalesce((p_payload->>'is_featured')::boolean, false),
      is_fresh          = coalesce((p_payload->>'is_fresh')::boolean, false),
      updated_at        = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'PRODUCT_NOT_FOUND' using errcode = 'no_data_found';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_product(uuid, jsonb) from public;
grant execute on function public.admin_upsert_product(uuid, jsonb) to authenticated;

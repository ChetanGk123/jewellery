-- 0008_admin_products.sql — Admin product writes (Phase 3.4)
--
-- `product` is publicly readable (the storefront catalogue), but has no write
-- policy — so mutations go through this SECURITY DEFINER RPC, gated on is_admin()
-- (0006) exactly like the order-status write path (0007). An admin's own cookie
-- session can call it with no service-role key; the anon key is rejected.
--
-- admin_upsert_product: insert when p_id is null (a unique slug is generated
-- from the name), otherwise update the row (slug is preserved so storefront URLs
-- don't break). Returns the product id.

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
  v_id   uuid;
  v_base text;
  v_slug text;
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
      primary_image_url, material, badge, blurb, desc_long,
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

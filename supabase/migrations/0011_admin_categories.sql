-- 0011_admin_categories.sql — Admin category writes (Phase 3.5)
--
-- `category` is publicly readable (the storefront navigation) but has no write
-- policy, so mutations go through these SECURITY DEFINER RPCs, gated on
-- is_admin() (0006) exactly like the product write path (0008).
--
-- admin_upsert_category: insert when p_id is null (a unique slug is generated
-- from the name, sort_order appended to the end), otherwise update name +
-- description (slug + sort_order preserved so storefront URLs/ordering hold).
-- Returns the category id.
--
-- admin_delete_category: refuses to delete a category that still holds products
-- (raises CATEGORY_HAS_PRODUCTS) — the admin must re-home or remove those
-- products first. Blocking, not cascading: a silent re-home would move a
-- product's URL/breadcrumb out from under the customer.

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
  v_id   uuid;
  v_base text;
  v_slug text;
  v_name text := btrim(p_payload->>'name');
  v_desc text := nullif(btrim(p_payload->>'description'), '');
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if coalesce(v_name, '') = '' then
    raise exception 'NAME_REQUIRED' using errcode = 'check_violation';
  end if;

  if p_id is null then
    -- Slugify the name, then de-dupe with a numeric suffix.
    v_base := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
    if v_base = '' then v_base := 'category'; end if;
    v_slug := v_base;
    while exists (select 1 from category where slug = v_slug) loop
      v_slug := v_base || '-' || floor(random() * 9000 + 1000)::int::text;
    end loop;

    insert into category (name, slug, description, sort_order)
    values (
      v_name,
      v_slug,
      v_desc,
      coalesce((select max(sort_order) from category), 0) + 1
    )
    returning id into v_id;
  else
    update category set
      name        = v_name,
      description = v_desc
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

create or replace function public.admin_delete_category(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  select count(*) into v_count from product where category_id = p_id;
  if v_count > 0 then
    raise exception 'CATEGORY_HAS_PRODUCTS' using errcode = 'foreign_key_violation';
  end if;

  delete from category where id = p_id;
end;
$$;

revoke all on function public.admin_delete_category(uuid) from public;
grant execute on function public.admin_delete_category(uuid) to authenticated;

-- 0037_bulk_upsert_rpcs.sql — All-or-nothing bulk upserts for the Excel
-- import (products / categories / coupons).
--
-- Each function takes a jsonb array of {row_num, id, payload} elements and
-- loops the EXISTING single-row admin_upsert_* RPC per element, so validation,
-- slug generation, and error codes stay defined in exactly one place. Per-row
-- failures are caught in a subtransaction and collected; if any row failed the
-- function raises BULK_ROW_ERRORS:<json> at the end, which rolls back every
-- row (all-or-nothing) while still carrying per-row diagnostics out to the
-- server action. `row_num` is the sheet row the admin sees, echoed back
-- verbatim for error messages.

create or replace function public.admin_bulk_upsert_products(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item    jsonb;
  v_created int := 0;
  v_updated int := 0;
  v_errors  jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) > 2000 then
    raise exception 'BULK_INVALID' using errcode = '23514';
  end if;

  for v_item in select * from jsonb_array_elements(p_rows) loop
    begin
      perform public.admin_upsert_product(
        nullif(v_item->>'id', '')::uuid,
        v_item->'payload');
      if coalesce(v_item->>'id', '') = '' then v_created := v_created + 1;
      else v_updated := v_updated + 1; end if;
    exception when others then
      -- Cap the collected diagnostics so the raised message stays bounded.
      if jsonb_array_length(v_errors) < 50 then
        v_errors := v_errors || jsonb_build_object(
          'row_num', coalesce((v_item->>'row_num')::int, 0),
          'code', SQLSTATE,
          'message', SQLERRM);
      end if;
    end;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    raise exception 'BULK_ROW_ERRORS:%', v_errors::text using errcode = '23514';
  end if;

  return jsonb_build_object('created', v_created, 'updated', v_updated);
end
$$;

create or replace function public.admin_bulk_upsert_categories(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item    jsonb;
  v_created int := 0;
  v_updated int := 0;
  v_errors  jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) > 2000 then
    raise exception 'BULK_INVALID' using errcode = '23514';
  end if;

  for v_item in select * from jsonb_array_elements(p_rows) loop
    begin
      perform public.admin_upsert_category(
        nullif(v_item->>'id', '')::uuid,
        v_item->'payload');
      if coalesce(v_item->>'id', '') = '' then v_created := v_created + 1;
      else v_updated := v_updated + 1; end if;
    exception when others then
      if jsonb_array_length(v_errors) < 50 then
        v_errors := v_errors || jsonb_build_object(
          'row_num', coalesce((v_item->>'row_num')::int, 0),
          'code', SQLSTATE,
          'message', SQLERRM);
      end if;
    end;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    raise exception 'BULK_ROW_ERRORS:%', v_errors::text using errcode = '23514';
  end if;

  return jsonb_build_object('created', v_created, 'updated', v_updated);
end
$$;

create or replace function public.admin_bulk_upsert_coupons(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item    jsonb;
  v_created int := 0;
  v_updated int := 0;
  v_errors  jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) > 2000 then
    raise exception 'BULK_INVALID' using errcode = '23514';
  end if;

  for v_item in select * from jsonb_array_elements(p_rows) loop
    begin
      perform public.admin_upsert_coupon(
        nullif(v_item->>'id', '')::uuid,
        v_item->'payload');
      if coalesce(v_item->>'id', '') = '' then v_created := v_created + 1;
      else v_updated := v_updated + 1; end if;
    exception when others then
      if jsonb_array_length(v_errors) < 50 then
        v_errors := v_errors || jsonb_build_object(
          'row_num', coalesce((v_item->>'row_num')::int, 0),
          'code', SQLSTATE,
          'message', SQLERRM);
      end if;
    end;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    raise exception 'BULK_ROW_ERRORS:%', v_errors::text using errcode = '23514';
  end if;

  return jsonb_build_object('created', v_created, 'updated', v_updated);
end
$$;

revoke all on function public.admin_bulk_upsert_products(jsonb) from public;
revoke all on function public.admin_bulk_upsert_categories(jsonb) from public;
revoke all on function public.admin_bulk_upsert_coupons(jsonb) from public;
-- Supabase default privileges also grant anon; strip it (is_admin() would
-- reject anon anyway, but keep the surface tight).
revoke all on function public.admin_bulk_upsert_products(jsonb) from anon;
revoke all on function public.admin_bulk_upsert_categories(jsonb) from anon;
revoke all on function public.admin_bulk_upsert_coupons(jsonb) from anon;
grant execute on function public.admin_bulk_upsert_products(jsonb) to authenticated;
grant execute on function public.admin_bulk_upsert_categories(jsonb) to authenticated;
grant execute on function public.admin_bulk_upsert_coupons(jsonb) to authenticated;

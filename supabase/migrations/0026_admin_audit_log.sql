-- 0026_admin_audit_log.sql
-- TASKS 5.8 — attribute admin mutations. Status changes, price edits, settings
-- saves and review approvals were previously unrecorded; this adds an
-- append-only audit trail so a COD dispute or a price mistake can be traced to
-- who/when.
--
-- Design: one audit table + a single AFTER trigger function wired to the four
-- tables whose admin writes matter (order, product, setting, review). We attach
-- triggers rather than embedding INSERTs inside each SECURITY DEFINER write RPC
-- because:
--   * it avoids re-emitting four production functions (place_order, checkout and
--     admin writes stay byte-for-byte untouched — no risk of breakage);
--   * auth.uid() still resolves inside those definer RPCs (the JWT GUC is
--     session-level, unaffected by SECURITY DEFINER role switching), so the real
--     actor is captured;
--   * an is_admin() gate means only admin-context changes are logged — customer
--     writes (checkout stock decrements, self-service order cancels) are skipped;
--   * any future admin write path is covered for free.
-- Mirrors the existing per-grant `admin_role_audit` table (0023); that one stays
-- as-is (team grants/revokes already log there).

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  actor_email text,
  action      text not null,   -- e.g. order.status, product.price, product.update, product.stock, product.create, setting.update, review.status
  entity_type text not null,   -- order | product | setting | review
  entity_id   text,            -- order_no / product slug / 'store' / review id
  summary     text,            -- human one-liner ("Confirmed → Shipped")
  meta        jsonb not null default '{}'::jsonb,  -- structured before/after
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

-- Admins read the log; nothing inserts through the API. Only the SECURITY
-- DEFINER trigger below writes (owner-run, RLS-bypassing) — so no INSERT policy.
drop policy if exists admin_audit_log_read on public.admin_audit_log;
create policy admin_audit_log_read on public.admin_audit_log
  for select to authenticated using (public.is_admin());

-- Single trigger writer. SECURITY DEFINER so it can read auth.users and insert
-- into the sealed audit table regardless of the caller's role. tg_argv[0] names
-- the entity so one function serves every table.
create or replace function public.tg_admin_audit()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_entity  text := tg_argv[0];
  v_action  text;
  v_eid     text;
  v_summary text;
  v_meta    jsonb := '{}'::jsonb;
begin
  -- Only admin-initiated changes belong in the admin audit log.
  if not public.is_admin() then
    return coalesce(new, old);
  end if;

  if v_entity = 'order' then
    if new.status is distinct from old.status then
      v_action  := 'order.status';
      v_eid     := new.order_no;
      v_summary := old.status || ' → ' || new.status;
      v_meta    := jsonb_build_object('from', old.status, 'to', new.status);
    else
      return new;
    end if;

  elsif v_entity = 'review' then
    if new.status is distinct from old.status then
      v_action  := 'review.status';
      v_eid     := new.id::text;
      v_summary := old.status || ' → ' || new.status;
      v_meta    := jsonb_build_object('from', old.status, 'to', new.status);
    else
      return new;
    end if;

  elsif v_entity = 'setting' then
    v_action  := 'setting.update';
    v_eid     := 'store';
    v_summary := 'Store settings updated';
    -- Record only the tracked columns that actually changed.
    v_meta    := jsonb_strip_nulls(jsonb_build_object(
      'store_name',
        case when new.store_name is distinct from old.store_name
          then jsonb_build_array(old.store_name, new.store_name) end,
      'support_email',
        case when new.support_email is distinct from old.support_email
          then jsonb_build_array(old.support_email, new.support_email) end,
      'phone',
        case when new.phone is distinct from old.phone
          then jsonb_build_array(old.phone, new.phone) end,
      'gstin',
        case when new.gstin is distinct from old.gstin
          then jsonb_build_array(old.gstin, new.gstin) end,
      'cod_enabled',
        case when new.cod_enabled is distinct from old.cod_enabled
          then jsonb_build_array(old.cod_enabled, new.cod_enabled) end,
      'free_ship_threshold_paise',
        case when new.free_ship_threshold_paise is distinct from old.free_ship_threshold_paise
          then jsonb_build_array(old.free_ship_threshold_paise, new.free_ship_threshold_paise) end,
      'flat_rate_paise',
        case when new.flat_rate_paise is distinct from old.flat_rate_paise
          then jsonb_build_array(old.flat_rate_paise, new.flat_rate_paise) end
    ));

  elsif v_entity = 'product' then
    v_eid := coalesce(new.slug, new.id::text);
    if tg_op = 'INSERT' then
      v_action  := 'product.create';
      v_summary := 'Created ' || new.name;
      v_meta    := jsonb_build_object(
        'price_paise', new.price_paise, 'stock', new.stock, 'status', new.status);
    elsif new.price_paise is distinct from old.price_paise then
      v_action  := 'product.price';
      v_summary := new.name || ': price ' || old.price_paise || ' → ' || new.price_paise || ' (paise)';
      v_meta    := jsonb_build_object('from_paise', old.price_paise, 'to_paise', new.price_paise);
    elsif (new.name, new.sku, new.status, new.mrp_paise, new.category_id,
           new.badge, new.material, new.is_featured, new.is_fresh)
          is distinct from
          (old.name, old.sku, old.status, old.mrp_paise, old.category_id,
           old.badge, old.material, old.is_featured, old.is_fresh) then
      v_action  := 'product.update';
      v_summary := 'Edited ' || new.name;
      v_meta    := jsonb_build_object('status', new.status, 'stock', new.stock);
    elsif new.stock is distinct from old.stock then
      -- Stock-only movement (admin edit or restock on cancel).
      v_action  := 'product.stock';
      v_summary := new.name || ': stock ' || old.stock || ' → ' || new.stock;
      v_meta    := jsonb_build_object('from', old.stock, 'to', new.stock);
    else
      return new;
    end if;

  else
    return coalesce(new, old);
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into admin_audit_log (
    actor_id, actor_email, action, entity_type, entity_id, summary, meta
  ) values (
    v_uid, v_email, v_action, v_entity, v_eid, v_summary, v_meta
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_order on public."order";
create trigger trg_audit_order
  after update on public."order"
  for each row execute function public.tg_admin_audit('order');

drop trigger if exists trg_audit_review on public.review;
create trigger trg_audit_review
  after update on public.review
  for each row execute function public.tg_admin_audit('review');

drop trigger if exists trg_audit_setting on public.setting;
create trigger trg_audit_setting
  after update on public.setting
  for each row execute function public.tg_admin_audit('setting');

drop trigger if exists trg_audit_product on public.product;
create trigger trg_audit_product
  after insert or update on public.product
  for each row execute function public.tg_admin_audit('product');

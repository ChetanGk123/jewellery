-- 0028_order_notes.sql
-- TASKS 5.16 — internal order notes ("deliver after 6pm"). Rather than a new
-- table, notes fold into the 5.8 audit log as `order.note` rows: they are
-- exactly audit-shaped (who/what/when, append-only, admin-read), and the
-- drawer's status timeline + notes then come from ONE query interleaved
-- chronologically with the trigger-written `order.status` rows.
--
-- admin_audit_log has no INSERT policy by design (0026: only the SECURITY
-- DEFINER trigger writes). This RPC is the second sanctioned writer — same
-- SECURITY DEFINER + is_admin() gate pattern as every admin write RPC.
-- It returns the inserted row's display fields so the UI can append the new
-- timeline entry without a re-read.

create or replace function public.admin_add_order_note(
  p_order_no text,
  p_note     text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_note  text := btrim(coalesce(p_note, ''));
  v_row   jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  -- Mirrors normalizeOrderNote (lib/admin/order-notes.ts): non-empty, <= 500.
  if v_note = '' or char_length(v_note) > 500 then
    raise exception 'INVALID_NOTE';
  end if;

  if not exists (select 1 from "order" where order_no = p_order_no) then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into admin_audit_log (
    actor_id, actor_email, action, entity_type, entity_id, summary
  ) values (
    v_uid, v_email, 'order.note', 'order', p_order_no, v_note
  )
  returning jsonb_build_object(
    'id', id, 'actor_email', actor_email, 'summary', summary,
    'created_at', created_at
  ) into v_row;

  return v_row;
end;
$$;

grant execute on function public.admin_add_order_note(text, text)
  to anon, authenticated, service_role;

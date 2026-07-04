-- 0016_contact_message_email_phone.sql — TASKS 3.8 follow-up
--
-- The contact form collected a single freeform `contact` field (email OR phone).
-- The admin queue needs BOTH lines to reach the customer, so split it into
-- separate `email` + `phone` columns (both required) and update the public
-- submit RPC to store them. Existing rows are back-filled from the old field
-- (email into email, a 10-digit value into phone) before the NOT NULL flip.

alter table contact_message add column if not exists email text;
alter table contact_message add column if not exists phone text;

-- Back-fill from the old single field so NOT NULL is safe (demo data — real rows
-- arrive with both via submit_contact_message from here on).
update contact_message
   set email = case when contact like '%@%' then contact else coalesce(email, '') end,
       phone = case when contact ~ '^[6-9][0-9]{9}$' then contact else coalesce(phone, '') end
 where email is null or phone is null;

alter table contact_message alter column email set not null;
alter table contact_message alter column phone set not null;
alter table contact_message drop column contact;

-- ── Public submit: now takes email + phone (both required) ─────────────────────
create or replace function public.submit_contact_message(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text;
  v_email   text;
  v_phone   text;
  v_subject text;
  v_body    text;
  v_ticket  text;
begin
  v_name    := btrim(coalesce(p_payload->>'name', ''));
  v_email   := btrim(coalesce(p_payload->>'email', ''));
  v_phone   := btrim(coalesce(p_payload->>'phone', ''));
  v_subject := nullif(btrim(coalesce(p_payload->>'subject', '')), '');
  v_body    := btrim(coalesce(p_payload->>'message', ''));

  if v_name = '' or v_email = '' or v_phone = '' or v_body = '' then
    raise exception 'MISSING_FIELDS' using errcode = 'check_violation';
  end if;

  v_name    := left(v_name, 80);
  v_email   := left(v_email, 120);
  v_phone   := left(v_phone, 20);
  v_subject := left(v_subject, 120);
  v_body    := left(v_body, 2000);

  v_ticket := 'TK-'
    || to_char((now() at time zone 'Asia/Kolkata'), 'YYMMDD')
    || '-' || lpad(nextval('contact_message_no_seq')::text, 3, '0');

  insert into contact_message (ticket_no, subject, body, name, email, phone, status)
  values (v_ticket, v_subject, v_body, v_name, v_email, v_phone, 'New');

  return jsonb_build_object('ticket_no', v_ticket);
end;
$$;

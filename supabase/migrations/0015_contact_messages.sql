-- 0015_contact_messages.sql — TASKS 3.8 Messages (contact-form ticket queue)
--
-- Lands the `contact_message` table + its write paths. The storefront Contact
-- form was UI-only; it now submits through `submit_contact_message`, a
-- SECURITY DEFINER RPC callable by anon (the table stays RLS-sealed — no public
-- insert policy) that mints the ticket number atomically and stores the enquiry
-- as a New ticket. Admins read every ticket (is_admin() RLS) and move it along
-- the New → In Progress → Resolved flow through `admin_set_message_status`
-- (same RPC-only write model as orders / reviews / coupons; no service key).

create table if not exists contact_message (
  id         uuid primary key default gen_random_uuid(),
  ticket_no  text not null unique,
  subject    text,
  body       text not null,
  name       text not null,
  contact    text not null,   -- email or phone, as the customer typed it
  status     text not null default 'New'
             check (status in ('New', 'In Progress', 'Resolved')),
  created_at timestamptz not null default now()
);

create index if not exists contact_message_status_created_idx
  on contact_message (status, created_at desc);

-- Global ticket counter (TK-YYMMDD-### uses lpad-3; it grows past 3 digits fine).
create sequence if not exists contact_message_no_seq start with 1;

alter table contact_message enable row level security;

-- Admins read every ticket. No public read, no public insert — writes are RPC-only.
drop policy if exists "contact_message_admin_read" on contact_message;
create policy "contact_message_admin_read" on contact_message
  for select to authenticated using (public.is_admin());

-- ── Public submit: mint the ticket number + store the enquiry ──────────────────
create or replace function public.submit_contact_message(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text;
  v_contact text;
  v_subject text;
  v_body    text;
  v_ticket  text;
begin
  v_name    := btrim(coalesce(p_payload->>'name', ''));
  v_contact := btrim(coalesce(p_payload->>'contact', ''));
  v_subject := nullif(btrim(coalesce(p_payload->>'subject', '')), '');
  v_body    := btrim(coalesce(p_payload->>'message', ''));

  if v_name = '' or v_contact = '' or v_body = '' then
    raise exception 'MISSING_FIELDS' using errcode = 'check_violation';
  end if;

  -- Clamp lengths defensively (the server action validates too, but this RPC is
  -- the actual write boundary and anon-callable).
  v_name    := left(v_name, 80);
  v_contact := left(v_contact, 120);
  v_subject := left(v_subject, 120);
  v_body    := left(v_body, 2000);

  v_ticket := 'TK-'
    || to_char((now() at time zone 'Asia/Kolkata'), 'YYMMDD')
    || '-' || lpad(nextval('contact_message_no_seq')::text, 3, '0');

  insert into contact_message (ticket_no, subject, body, name, contact, status)
  values (v_ticket, v_subject, v_body, v_name, v_contact, 'New');

  return jsonb_build_object('ticket_no', v_ticket);
end;
$$;

grant execute on function public.submit_contact_message(jsonb) to anon, authenticated;

-- ── Admin: move a ticket along the flow ───────────────────────────────────────
create or replace function public.admin_set_message_status(
  p_id     uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if p_status not in ('New', 'In Progress', 'Resolved') then
    raise exception 'INVALID_STATUS: %', p_status using errcode = 'check_violation';
  end if;

  update contact_message set status = p_status where id = p_id;
  if not found then
    raise exception 'MESSAGE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  return p_status;
end;
$$;

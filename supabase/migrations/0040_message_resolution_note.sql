-- 0040_message_resolution_note.sql — TASKS 6.13 Message resolution summary
--
-- Resolved tickets carried no record of HOW they were resolved — a month later
-- "Resolved" tells the operator nothing. Adds `resolution_note` and re-states
-- `admin_set_message_status` with a third param: moving to Resolved now
-- REQUIRES a non-empty note (stored trimmed, capped at 500 chars like order
-- notes 0028); moving away from Resolved (reopen) clears it so a stale summary
-- can't outlive the state it described (6.4d backward-clears-AWB precedent).
-- The 2-arg overload is dropped for unambiguous PostgREST resolution (0032).

alter table contact_message add column if not exists resolution_note text;

drop function if exists public.admin_set_message_status(uuid, text);

create or replace function public.admin_set_message_status(
  p_id     uuid,
  p_status text,
  p_note   text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  if p_status not in ('New', 'In Progress', 'Resolved') then
    raise exception 'INVALID_STATUS: %', p_status using errcode = 'check_violation';
  end if;

  if p_status = 'Resolved' then
    v_note := nullif(btrim(coalesce(p_note, '')), '');
    if v_note is null then
      raise exception 'RESOLUTION_NOTE_REQUIRED' using errcode = 'check_violation';
    end if;
    if length(v_note) > 500 then
      raise exception 'NOTE_TOO_LONG' using errcode = 'check_violation';
    end if;
  else
    -- Reopening: the old summary described a resolution that no longer stands.
    v_note := null;
  end if;

  update contact_message
     set status = p_status,
         resolution_note = v_note
   where id = p_id;
  if not found then
    raise exception 'MESSAGE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  return p_status;
end;
$$;

-- Same execution surface as every admin RPC (0037/0039 pattern).
revoke all on function public.admin_set_message_status(uuid, text, text) from public;
revoke all on function public.admin_set_message_status(uuid, text, text) from anon;
grant execute on function public.admin_set_message_status(uuid, text, text) to authenticated;

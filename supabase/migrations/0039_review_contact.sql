-- 0039_review_contact.sql — TASKS 6.12 Contact reviewer from Reviews page
--
-- The `review` table stores only the reviewer's display `name` plus a nullable
-- `user_id` (purchase-required since 0022, so every new review carries one).
-- The console needs a way to reach the reviewer — email lives in `auth.users`
-- (never exposed to the client role directly) and phone on their latest order —
-- so the lookup is a SECURITY DEFINER RPC gated on is_admin(), mirroring every
-- other admin read that crosses an RLS boundary. Legacy `user_id`-null reviews
-- return null contact fields (the UI hides the buttons).

create or replace function public.admin_review_contact(p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_name    text;
  v_email   text;
  v_phone   text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;

  select user_id, name into v_user_id, v_name
    from review
   where id = p_review_id;
  if not found then
    raise exception 'REVIEW_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Pre-0022 reviews have no account link — nothing to look up.
  if v_user_id is null then
    return jsonb_build_object('name', v_name, 'email', null, 'phone', null);
  end if;

  select email into v_email
    from auth.users
   where id = v_user_id;

  -- The freshest phone we hold for this customer: their latest order's.
  select customer_phone into v_phone
    from "order"
   where user_id = v_user_id
   order by created_at desc
   limit 1;

  return jsonb_build_object('name', v_name, 'email', v_email, 'phone', v_phone);
end;
$$;

-- Callable only by signed-in sessions; the is_admin() gate does the real work.
-- (Supabase default privileges also grant anon; strip both, like 0037.)
revoke all on function public.admin_review_contact(uuid) from public;
revoke all on function public.admin_review_contact(uuid) from anon;
grant execute on function public.admin_review_contact(uuid) to authenticated;

-- 0034_realtime_publication.sql
-- 6.9: live admin console. Add the three "needs attention" tables to the
-- `supabase_realtime` publication so postgres_changes events flow to
-- subscribed clients. Authorization is unchanged: Realtime enforces RLS per
-- subscriber, so only sessions whose policies allow reading a row (the
-- is_admin() read policies from 0006/0015/0021) receive its events — an
-- anonymous storefront visitor subscribing to "order" gets nothing.
--
-- Guarded DO blocks: re-running (or a table already in the publication) is a
-- no-op, not an error.

do $$
begin
  alter publication supabase_realtime add table public."order";
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.review;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.contact_message;
exception
  when duplicate_object then null;
end $$;

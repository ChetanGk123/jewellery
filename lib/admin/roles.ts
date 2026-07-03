import type { User } from "@supabase/supabase-js";

/**
 * Admin authorization — the store operator's access to the `(admin)` console.
 *
 * Admin is a role stamped into the user's Supabase `app_metadata` (a JWT claim
 * that only the service role can set, so a customer can't grant it to
 * themselves). `isAdmin` is a PURE inspection of that claim with no I/O, so it's
 * safe to call anywhere — the Edge proxy, server components, or client forms
 * (after sign-in). See `supabase/migrations/0005_admin_role.sql` for granting.
 */
export const ADMIN_ROLE = "admin";

type AppMetadata = { role?: unknown; roles?: unknown };

export function isAdmin(user: User | null | undefined): boolean {
  const meta = user?.app_metadata as AppMetadata | undefined;
  if (meta?.role === ADMIN_ROLE) return true;
  if (Array.isArray(meta?.roles) && meta.roles.includes(ADMIN_ROLE)) return true;
  return false;
}

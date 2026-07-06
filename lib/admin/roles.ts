/**
 * Admin authorization — the store operator's access to the `(admin)` console.
 *
 * Admin is a role stamped into the user's Supabase `app_metadata` (a JWT claim
 * that only the service role can set, so a customer can't grant it to
 * themselves). `isAdmin` is a PURE inspection of that claim with no I/O, so it's
 * safe to call anywhere — the Edge proxy, server components, or client forms
 * (after sign-in). See `supabase/migrations/0005_admin_role.sql` for granting.
 *
 * Accepts anything carrying `app_metadata`: a full Supabase `User` (from
 * `getUser()`) or the verified JWT claims from `getClaims()` — the proxy uses
 * the latter so the gate never costs an Auth server round trip (TASKS 4.18).
 */
export const ADMIN_ROLE = "admin";

type AppMetadata = { role?: unknown; roles?: unknown };

type HasAppMetadata = { app_metadata?: unknown };

export function isAdmin(subject: HasAppMetadata | null | undefined): boolean {
  const meta = (subject?.app_metadata ?? undefined) as AppMetadata | undefined;
  if (meta?.role === ADMIN_ROLE) return true;
  if (Array.isArray(meta?.roles) && meta.roles.includes(ADMIN_ROLE)) return true;
  return false;
}

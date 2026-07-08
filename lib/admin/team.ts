/**
 * Client-safe admin-team types + list-cell helpers for the "Team" page
 * (in-console admin management). Free of `server-only` imports so the client
 * `TeamView` and the server data module (`lib/db/admin-team.ts`) can share them.
 * Mirrors the split used by `lib/admin/subscriber.ts` / `lib/admin/coupon.ts`.
 */

/** An admin (a user carrying the `app_metadata.role = 'admin'` claim). */
export type AdminUser = {
  id: string
  email: string
  /** ISO instant the admin claim was granted (falls back to account creation). */
  grantedAt: string
  /** True for the operator's own row — the UI blocks self-revoke. */
  isSelf: boolean
}

/** A grant/revoke entry from `admin_role_audit`, camelCase. */
export type RoleAuditEntry = {
  id: string
  action: "grant" | "revoke"
  actorEmail: string | null
  targetEmail: string | null
  /** ISO instant the action happened. */
  createdAt: string
}

/** The avatar glyph — first letter of the address, uppercased ("a@b.com" → "A"). */
export function adminInitial(email: string): string {
  return email.trim().charAt(0).toUpperCase() || "?"
}

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** "12 Jun 2026", or "" if the timestamp can't be parsed. */
export function adminDateLabel(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : DATE_FMT.format(date)
}

/** One-line summary of an audit entry, e.g. "asha@… granted access to ravi@…". */
export function roleAuditSummary(entry: RoleAuditEntry): string {
  const actor = entry.actorEmail ?? "An admin"
  const target = entry.targetEmail ?? "an account"
  const verb = entry.action === "grant" ? "granted access to" : "removed access from"
  return `${actor} ${verb} ${target}`
}

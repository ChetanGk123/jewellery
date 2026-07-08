"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"
import { createServerClient } from "@/lib/db/server"
import { ROUTES } from "@/lib/routes"

export type TeamActionResult = { ok: boolean; error?: string; notice?: string }

/** Loose email shape check — the RPC is the real authority (looks up the row). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Loose UUID shape check for the revoke target. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Map the RPC's raised exceptions (0023) to friendly copy. `ALREADY_ADMIN` is a
 * benign "nothing to do" case, surfaced as a `notice` rather than an `error`.
 */
function messageFor(code: string | undefined, raw: string): TeamActionResult {
  if (raw.includes("NO_ACCOUNT"))
    return {
      ok: false,
      error: "No account exists for that email yet — ask them to sign up first, then grant access.",
    }
  if (raw.includes("ALREADY_ADMIN")) return { ok: true, notice: "That person is already an admin." }
  if (raw.includes("CANNOT_SELF_REVOKE"))
    return { ok: false, error: "You can't remove your own admin access." }
  if (raw.includes("LAST_ADMIN"))
    return { ok: false, error: "You can't remove the only remaining admin." }
  if (raw.includes("NOT_AN_ADMIN")) return { ok: false, error: "That person isn't an admin." }
  if (raw.includes("NOT_ADMIN"))
    return { ok: false, error: "You don't have permission to do that." }
  return { ok: false, error: "Something went wrong. Please try again." }
}

/**
 * Grant admin access to an existing account by email, via the admin-only
 * `admin_grant_role` RPC (0023). The RPC re-checks admin, that the account
 * exists, and idempotency; this action adds the authoritative `requireAdmin`
 * gate and a light shape check.
 */
export async function grantAdmin(email: string): Promise<TeamActionResult> {
  await requireAdmin(ROUTES.adminTeam)

  const trimmed = email?.trim() ?? ""
  if (!EMAIL_RE.test(trimmed)) {
    return { ok: false, error: "Enter a valid email address." }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_grant_role", { p_email: trimmed })

  if (error) return messageFor(error.code, error.message)

  revalidatePath(ROUTES.adminTeam)
  return {
    ok: true,
    notice: "Access granted. They'll get it on their next sign-in.",
  }
}

/**
 * Revoke admin access from a user, via the admin-only `admin_revoke_role` RPC
 * (0023). The RPC blocks removing yourself or the last remaining admin.
 */
export async function revokeAdmin(userId: string): Promise<TeamActionResult> {
  await requireAdmin(ROUTES.adminTeam)

  if (!UUID_RE.test(userId?.trim() ?? "")) {
    return { ok: false, error: "That admin no longer exists." }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_revoke_role", {
    p_user_id: userId,
  })

  if (error) return messageFor(error.code, error.message)

  revalidatePath(ROUTES.adminTeam)
  return { ok: true }
}

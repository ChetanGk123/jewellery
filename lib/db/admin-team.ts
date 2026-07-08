import "server-only"
import type { AdminUser, RoleAuditEntry } from "@/lib/admin/team"
import { type AdminRead, loadAdmin } from "./admin-read"
import { createServerClient } from "./server"

/**
 * Admin team management (in-console admin grant/revoke). Both reads go through
 * the admin's cookie session: the roster via the `admin_list_admins` RPC (0023,
 * which reads the privileged auth.users table as SECURITY DEFINER), and the audit
 * trail via the `admin_role_audit` table's `role_audit_admin_read` RLS policy.
 * Writes go through the `admin_grant_role` / `admin_revoke_role` RPCs, never a
 * direct table write. Each degrades to an empty list on error so the console
 * still renders with an `AdminErrorBanner` (TASKS 5.1).
 */
export async function listAdmins(): Promise<AdminRead<AdminUser[]>> {
  return loadAdmin(
    "team",
    async () => {
      const supabase = await createServerClient()
      const { data, error } = await supabase.rpc("admin_list_admins")
      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        grantedAt: row.granted_at,
        isSelf: row.is_self,
      }))
    },
    [],
  )
}

/** Recent grant/revoke history, newest first (capped). */
export async function listRoleAudit(): Promise<AdminRead<RoleAuditEntry[]>> {
  return loadAdmin(
    "team-audit",
    async () => {
      const supabase = await createServerClient()
      const { data, error } = await supabase
        .from("admin_role_audit")
        .select("id, action, actor_email, target_email, created_at")
        .order("created_at", { ascending: false })
        .limit(50)
      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id,
        action: row.action === "revoke" ? "revoke" : "grant",
        actorEmail: row.actor_email,
        targetEmail: row.target_email,
        createdAt: row.created_at,
      }))
    },
    [],
  )
}

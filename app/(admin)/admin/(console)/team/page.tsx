import type { Metadata } from "next"
import { TeamView } from "@/components/admin/team/TeamView"
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner"
import { requireAdmin } from "@/lib/admin/auth"
import { ADMIN_PAGE_META } from "@/lib/admin/nav"
import { listAdmins, listRoleAudit } from "@/lib/db/admin-team"
import { ROUTES } from "@/lib/routes"

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminTeam].title,
}

export default async function AdminTeamPage() {
  await requireAdmin(ROUTES.adminTeam)

  const [admins, audit] = await Promise.all([listAdmins(), listRoleAudit()])

  return (
    <div className="flex flex-col gap-6">
      {(admins.error || audit.error) && <AdminErrorBanner />}
      <TeamView admins={admins.data} audit={audit.data} />
    </div>
  )
}

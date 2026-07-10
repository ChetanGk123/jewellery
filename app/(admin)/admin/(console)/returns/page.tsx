import type { Metadata } from "next"
import { ReturnsView } from "@/components/admin/returns/ReturnsView"
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner"
import { ADMIN_PAGE_META } from "@/lib/admin/nav"
import { listReturnRequests } from "@/lib/db/admin-returns"
import { toReturnFilter } from "@/lib/returns"
import { ROUTES } from "@/lib/routes"

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminReturns].title,
}

/**
 * Returns queue page (TASKS 8.7d). Reads the return requests (admin RLS) with
 * their order identity + signed photo URLs, driven by the `?status` filter
 * (Open / Closed / All), and hands them to the client `ReturnsView`, which
 * owns the transition actions incl. the record-refund step.
 */
export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const sp = await searchParams
  const { data, error } = await listReturnRequests(toReturnFilter(sp.status))
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <ReturnsView data={data} />
    </div>
  )
}

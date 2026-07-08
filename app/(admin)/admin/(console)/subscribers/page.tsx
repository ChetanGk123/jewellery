import type { Metadata } from "next"
import { SubscribersView } from "@/components/admin/subscribers/SubscribersView"
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner"
import { ADMIN_PAGE_META } from "@/lib/admin/nav"
import { listAdminSubscribers } from "@/lib/db/admin-subscribers"
import { ROUTES } from "@/lib/routes"

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminSubscribers].title,
}

/**
 * Subscribers page (TASKS 3.9, paginated 5.10). Reads one page of the mailing
 * list (admin RLS) plus the three KPI cards (from aggregate counts) server-side,
 * driven by URL params (`?q`/`?page`), and hands the page to the client
 * `SubscribersView`, which owns search, Copy emails, Export CSV and remove.
 */
export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const sp = await searchParams
  const { data, error } = await listAdminSubscribers({
    search: sp.q ?? "",
    page: Math.max(1, Number(sp.page) || 1),
  })
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <SubscribersView page={data} />
    </div>
  )
}

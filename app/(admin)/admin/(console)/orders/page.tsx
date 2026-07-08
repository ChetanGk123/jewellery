import type { Metadata } from "next"
import { OrdersView } from "@/components/admin/orders/OrdersView"
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner"
import { ADMIN_PAGE_META } from "@/lib/admin/nav"
import { listAdminOrders, toOrderFilter } from "@/lib/db/admin-orders"
import { ROUTES } from "@/lib/routes"

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminOrders].title,
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>
}) {
  const sp = await searchParams
  const filter = toOrderFilter(sp.status)
  const page = Math.max(1, Number(sp.page) || 1)
  const search = sp.q ?? ""
  const { data, error } = await listAdminOrders({ filter, page, search })
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <OrdersView page={data} />
    </div>
  )
}

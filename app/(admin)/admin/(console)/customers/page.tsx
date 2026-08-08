import type { Metadata } from "next"
import { CustomersView } from "@/components/admin/customers/CustomersView"
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner"
import { ADMIN_PAGE_META } from "@/lib/admin/nav"
import { toCustomerSort } from "@/lib/admin/customers"
import { getAdminCustomerDetail, listAdminCustomers } from "@/lib/db/admin-customers"
import { ROUTES } from "@/lib/routes"

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminCustomers].title,
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    sort?: string
    page?: string
    customer?: string
  }>
}) {
  const sp = await searchParams
  const { data, error } = await listAdminCustomers({
    search: sp.search ?? "",
    sort: toCustomerSort(sp.sort),
    page: Math.max(1, Number(sp.page) || 1),
  })

  // `?customer=<user_id>` opens the detail. The header comes from the row
  // already on this page — the aggregate is the RPC's job, and re-deriving it
  // here would risk the two disagreeing. Deep links pair the id with a `search`
  // that narrows the list to that customer (see OrderDrawer), so the row is
  // present regardless of store size; a stale id falls back to the list.
  const header = sp.customer ? (data.rows.find((r) => r.userId === sp.customer) ?? null) : null
  const detailRead = header ? await getAdminCustomerDetail(header.userId, header) : null

  return (
    <div className="flex flex-col gap-6">
      {(error || detailRead?.error) && <AdminErrorBanner />}
      <CustomersView page={data} detail={detailRead?.data ?? null} />
    </div>
  )
}

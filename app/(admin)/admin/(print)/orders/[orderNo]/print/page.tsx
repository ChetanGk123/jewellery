import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { OrderPrintView } from "@/components/admin/orders/OrderPrintView"
import { toPrintDoc } from "@/lib/admin/print"
import { requireAdmin } from "@/lib/admin/auth"
import { getAdminOrderByNo } from "@/lib/db/admin-orders"
import { getStoreInfo, getStoreSettings } from "@/lib/db/settings"
import { ROUTES } from "@/lib/routes"

export const metadata: Metadata = {
  title: "Print order",
  robots: { index: false, follow: false },
}

/**
 * Order print page (TASKS 5.12) — one document per visit: the invoice by
 * default, the packing slip with `?doc=packing-slip`, so each prints on its
 * own. Lives in the `(print)` route group — a sibling of `(console)` — so the
 * admin sidebar/topbar chrome never ends up on paper; because it skips the
 * console layout, it re-runs the authoritative `requireAdmin` gate itself (the
 * proxy's coarse /admin redirect still applies too). Unknown order numbers 404.
 */
export default async function AdminOrderPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNo: string }>
  searchParams: Promise<{ doc?: string }>
}) {
  const [{ orderNo }, sp] = await Promise.all([params, searchParams])
  const decoded = decodeURIComponent(orderNo)
  const doc = toPrintDoc(sp.doc)
  await requireAdmin(ROUTES.adminOrderPrint(decoded, doc))

  const [order, settings, info] = await Promise.all([
    getAdminOrderByNo(decoded),
    getStoreSettings(),
    getStoreInfo(),
  ])
  if (!order) notFound()

  return <OrderPrintView order={order} settings={settings} info={info} doc={doc} />
}

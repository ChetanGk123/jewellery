import type { Metadata } from "next"
import { AnalyticsView } from "@/components/admin/analytics/AnalyticsView"
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner"
import { toAnalyticsRange } from "@/lib/admin/analytics-range"
import { ADMIN_PAGE_META } from "@/lib/admin/nav"
import { getProductAnalytics } from "@/lib/db/admin-analytics"
import { ROUTES } from "@/lib/routes"

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminAnalytics].title,
}

/**
 * Product Analytics page (TASKS 3.10; window + pagination in 6.10). Aggregates
 * the selected date window of `order_item` history server-side (KPIs +
 * per-product units/revenue/trend/monthly) and hands it to the client
 * `AnalyticsView`, which owns sorting, the `?page` slice, and the list ↔
 * detail toggle. `?from/?to` move the window (default: last 6 months);
 * `?product=<id>` (the products-row deep link, TASKS 5.13) opens that
 * product's detail view directly; unknown ids fall back to the list.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; from?: string; to?: string; page?: string }>
}) {
  const sp = await searchParams
  // Today as an IST calendar date ("en-CA" formats as YYYY-MM-DD).
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
  const range = toAnalyticsRange(sp.from, sp.to, today)
  const page = Math.max(1, Number(sp.page) || 1)
  const {
    data: { kpis, products },
    error,
  } = await getProductAnalytics(range)
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <AnalyticsView
        kpis={kpis}
        products={products}
        initialProductId={sp.product ?? null}
        range={range}
        page={page}
      />
    </div>
  )
}

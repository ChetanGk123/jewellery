import type { Metadata } from "next";
import { AnalyticsView } from "@/components/admin/analytics/AnalyticsView";
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { getProductAnalytics } from "@/lib/db/admin-analytics";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminAnalytics].title,
};

/**
 * Product Analytics page (TASKS 3.10). Aggregates 6 months of `order_item`
 * history server-side (KPIs + per-product units/revenue/trend/monthly) and hands
 * it to the client `AnalyticsView`, which owns sorting and the list ↔ detail
 * toggle. `?product=<id>` (the products-row deep link, TASKS 5.13) opens that
 * product's detail view directly; unknown ids fall back to the list.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const [{ product }, result] = await Promise.all([
    searchParams,
    getProductAnalytics(),
  ]);
  const {
    data: { kpis, products },
    error,
  } = result;
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <AnalyticsView
        kpis={kpis}
        products={products}
        initialProductId={product ?? null}
      />
    </div>
  );
}

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
 * toggle.
 */
export default async function AdminAnalyticsPage() {
  const {
    data: { kpis, products },
    error,
  } = await getProductAnalytics();
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <AnalyticsView kpis={kpis} products={products} />
    </div>
  );
}

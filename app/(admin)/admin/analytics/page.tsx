import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/ui/AdminPlaceholder";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminAnalytics].title,
};

export default function AdminAnalyticsPage() {
  return (
    <AdminPlaceholder
      title="Product Analytics"
      phase="3.10"
      description="Per-product sales performance over time — units sold, revenue, best sellers and low-stock — with sortable trends drawn from real order history."
    />
  );
}

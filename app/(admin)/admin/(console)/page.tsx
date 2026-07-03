import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/ui/AdminPlaceholder";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <AdminPlaceholder
      title="Dashboard"
      phase="3.2"
      description="KPIs for today's orders and revenue, a 7-day revenue chart, recent orders, low-stock alerts and top sellers — all computed live from your orders and catalogue."
    />
  );
}

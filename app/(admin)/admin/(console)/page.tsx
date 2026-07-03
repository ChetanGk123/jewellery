import type { Metadata } from "next";
import { DashboardView } from "@/components/admin/dashboard/DashboardView";
import { getDashboardData } from "@/lib/db/admin-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const data = await getDashboardData();
  return <DashboardView data={data} />;
}

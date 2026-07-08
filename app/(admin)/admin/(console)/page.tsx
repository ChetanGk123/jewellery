import type { Metadata } from "next"
import { DashboardView } from "@/components/admin/dashboard/DashboardView"
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner"
import { getDashboardData } from "@/lib/db/admin-dashboard"

export const metadata: Metadata = { title: "Dashboard" }

export default async function AdminDashboardPage() {
  const { data, error } = await getDashboardData()
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <DashboardView data={data} />
    </div>
  )
}

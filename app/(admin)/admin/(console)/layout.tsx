import type { Metadata } from "next"
import { AdminRealtimeRefresher } from "@/components/admin/layout/AdminRealtimeRefresher"
import { AdminShell } from "@/components/admin/layout/AdminShell"
import { requireAdmin } from "@/lib/admin/auth"
import { getAdminNavCounts } from "@/lib/db/admin-metrics"

/**
 * Admin console chrome. A sibling route group to `(storefront)`, so it renders
 * inside the root layout WITHOUT the customer Header/Footer — it gets the
 * dark-maroon sidebar + topbar instead. `noindex` keeps the whole console out
 * of search engines.
 *
 * Gated: `requireAdmin` redirects anyone who isn't an allow-listed admin
 * (`app_metadata.role`) to the admin sign-in BEFORE any console data is fetched
 * or the chrome renders. The proxy does a coarse redirect first; this is the
 * authoritative check.
 */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · RJ Jewellers Admin" },
  robots: { index: false, follow: false },
}

export default async function AdminConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdmin()
  const counts = await getAdminNavCounts()

  // Prefer a real name for the footer avatar initials; fall back to the email.
  const meta = admin.user_metadata as { full_name?: string; name?: string } | undefined
  const email = admin.email ?? "Admin"
  const adminName = meta?.full_name?.trim() || meta?.name?.trim() || email

  return (
    <AdminShell counts={counts} adminName={adminName} adminEmail={email}>
      {/* Live refresh (6.9): repaints the console when orders/reviews/messages
          change — new orders appear and bell counts update without a reload. */}
      <AdminRealtimeRefresher />
      {children}
    </AdminShell>
  )
}

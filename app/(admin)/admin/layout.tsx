import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/layout/AdminShell";
import { getAdminNavCounts } from "@/lib/db/admin-metrics";

/**
 * Admin console chrome. A sibling route group to `(storefront)`, so it renders
 * inside the root layout WITHOUT the customer Header/Footer — it gets the
 * dark-maroon sidebar + topbar instead. `noindex` keeps the whole console out
 * of search engines.
 *
 * NOTE: the admin gate (allow-listed admin check) lands in Phase 3.1 — until
 * then these routes are unauthenticated. The foundation views expose no
 * customer data (aggregate counts only), and real data views (dashboard,
 * orders) come after the gate.
 */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · RJ Jewellers Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const counts = await getAdminNavCounts();

  return <AdminShell counts={counts}>{children}</AdminShell>;
}

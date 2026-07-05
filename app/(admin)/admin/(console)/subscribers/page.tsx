import type { Metadata } from "next";
import { SubscribersView } from "@/components/admin/subscribers/SubscribersView";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminSubscribers } from "@/lib/db/admin-subscribers";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminSubscribers].title,
};

/**
 * Subscribers page (TASKS 3.9). Reads the whole mailing list (admin RLS) plus
 * the three derived KPI cards server-side and hands them to the client
 * `SubscribersView`, which owns search, Copy emails, Export CSV and remove.
 */
export default async function AdminSubscribersPage() {
  const { rows, kpis } = await listAdminSubscribers();
  return <SubscribersView subscribers={rows} kpis={kpis} />;
}

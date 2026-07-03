import type { Metadata } from "next";
import { OrdersView } from "@/components/admin/orders/OrdersView";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminOrders, toOrderFilter } from "@/lib/db/admin-orders";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminOrders].title,
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = toOrderFilter(sp.status);
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await listAdminOrders({ filter, page });
  return <OrdersView page={data} />;
}

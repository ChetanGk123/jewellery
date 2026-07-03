import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/ui/AdminPlaceholder";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminOrders].title,
};

export default function AdminOrdersPage() {
  return (
    <AdminPlaceholder
      title="Orders"
      phase="3.3"
      description="The full order queue with status filters and a fulfilment drawer — advance orders Pending → Confirmed → Packed → Shipped → Delivered, view customer and address details, and cancel."
    />
  );
}

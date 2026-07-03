import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/ui/AdminPlaceholder";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminProducts].title,
};

export default function AdminProductsPage() {
  return (
    <AdminPlaceholder
      title="Products"
      phase="3.4"
      description="Your catalogue with search, category and status filters, add/edit product and CSV import — including the stock levels the storefront's in-stock badge reads."
    />
  );
}

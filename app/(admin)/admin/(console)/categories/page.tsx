import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/ui/AdminPlaceholder";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminCategories].title,
};

export default function AdminCategoriesPage() {
  return (
    <AdminPlaceholder
      title="Categories"
      phase="3.5"
      description="Manage collections with live product counts — create, edit and delete categories, with a safe re-home step for categories that still hold products."
    />
  );
}

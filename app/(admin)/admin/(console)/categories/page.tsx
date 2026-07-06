import type { Metadata } from "next";
import { CategoriesView } from "@/components/admin/categories/CategoriesView";
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminCategories } from "@/lib/db/admin-categories";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminCategories].title,
};

export default async function AdminCategoriesPage() {
  const { data: categories, error } = await listAdminCategories();
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <CategoriesView categories={categories} />
    </div>
  );
}

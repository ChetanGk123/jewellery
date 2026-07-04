import type { Metadata } from "next";
import { CategoriesView } from "@/components/admin/categories/CategoriesView";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminCategories } from "@/lib/db/admin-categories";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminCategories].title,
};

export default async function AdminCategoriesPage() {
  const categories = await listAdminCategories();
  return <CategoriesView categories={categories} />;
}

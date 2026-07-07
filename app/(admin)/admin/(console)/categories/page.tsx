import type { Metadata } from "next";
import { CategoriesView } from "@/components/admin/categories/CategoriesView";
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminCategories } from "@/lib/db/admin-categories";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminCategories].title,
};

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const { data, error } = await listAdminCategories({
    page: Math.max(1, Number(sp.page) || 1),
  });
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <CategoriesView page={data} />
    </div>
  );
}

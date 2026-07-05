import type { Metadata } from "next";
import { ProductsView } from "@/components/admin/products/ProductsView";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import {
  getAdminProductById,
  listAdminProducts,
  toProductStatusFilter,
} from "@/lib/db/admin-products";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminProducts].title,
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    category?: string;
    status?: string;
    page?: string;
    edit?: string;
  }>;
}) {
  const sp = await searchParams;
  // `?edit=<id>` (e.g. the Analytics "Edit product" deep link) opens that
  // product's modal on load — fetched directly so it works regardless of the
  // current list page/filter.
  const [data, initialEdit] = await Promise.all([
    listAdminProducts({
      search: sp.search ?? "",
      categoryId: sp.category ?? "All",
      status: toProductStatusFilter(sp.status),
      page: Math.max(1, Number(sp.page) || 1),
    }),
    sp.edit ? getAdminProductById(sp.edit) : Promise.resolve(null),
  ]);
  return <ProductsView page={data} initialEdit={initialEdit} />;
}

import type { Metadata } from "next";
import { ProductsView } from "@/components/admin/products/ProductsView";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminProducts, toProductStatusFilter } from "@/lib/db/admin-products";
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
  }>;
}) {
  const sp = await searchParams;
  const data = await listAdminProducts({
    search: sp.search ?? "",
    categoryId: sp.category ?? "All",
    status: toProductStatusFilter(sp.status),
    page: Math.max(1, Number(sp.page) || 1),
  });
  return <ProductsView page={data} />;
}

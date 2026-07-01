import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/storefront/listing/ProductListing";
import {
  getCategoryBySlug,
  getCategoryTiles,
  getMaterials,
  getProducts,
} from "@/lib/db/queries";
import { parseListingParams, type RawSearchParams } from "@/lib/listing";
import { ROUTES } from "@/lib/routes";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description:
      category.description ??
      `Shop ${category.name} — handcrafted artificial bridal jewellery from JR Jewellers.`,
  };
}

/**
 * Category listing page (TASKS 1.4 + 1.6) — the shared listing surface scoped to
 * one category. Material, price, and sort live in the URL search params; the
 * category itself is fixed by the route. Unknown slug → 404.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category: slug } = await params;
  const listing = parseListingParams(await searchParams);

  const [category, products, categories, materials] = await Promise.all([
    getCategoryBySlug(slug),
    getProducts({
      categorySlug: slug,
      material: listing.material,
      maxPaise: listing.maxPaise,
      sort: listing.sort,
    }),
    getCategoryTiles(),
    getMaterials(),
  ]);

  if (!category) notFound();

  const hasActiveFilters = Boolean(
    listing.material ||
      listing.maxPaise !== undefined ||
      listing.sort !== "featured",
  );

  const count = products.length;
  const noun = count === 1 ? "product" : "products";

  return (
    <ProductListing
      title={category.name}
      subtitle={`${count} ${noun}`}
      products={products}
      categories={categories}
      materials={materials}
      activeCategorySlug={category.slug}
      params={listing}
      hasActiveFilters={hasActiveFilters}
      resetHref={ROUTES.category(category.slug)}
    />
  );
}

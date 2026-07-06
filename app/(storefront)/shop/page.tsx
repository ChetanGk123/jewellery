import type { Metadata } from "next";
import { ProductListing } from "@/components/storefront/listing/ProductListing";
import {
  getCategoryTiles,
  getMaterials,
  getProductsPage,
} from "@/lib/db/queries";
import { parseListingParams, type RawSearchParams } from "@/lib/listing";
import { ROUTES } from "@/lib/routes";

type ShopPageProps = {
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({
  searchParams,
}: ShopPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  return {
    title: query ? `Search: ${query}` : "All Jewellery",
    description:
      "Browse the full RJ Jewellers range of handcrafted artificial bridal jewellery — bridal sets, necklaces, earrings and more.",
  };
}

/**
 * Shop / search landing (TASKS 1.6) — the full catalog with category, material,
 * and price facets plus sort, all driven by URL search params. Also the target
 * of the header search form (`?q=`).
 */
export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = parseListingParams(await searchParams);

  const [productsPage, categories, materials] = await Promise.all([
    getProductsPage(
      {
        material: params.material,
        maxPaise: params.maxPaise,
        search: params.query,
        sort: params.sort,
      },
      params.page,
    ),
    getCategoryTiles(),
    getMaterials(),
  ]);
  const { items: products, total, pageCount, page: servedPage } = productsPage;
  // The pager needs the page actually served, not the raw (possibly
  // out-of-range) request param — otherwise a clamped ?page=99 would render
  // page 1's products under a pager that still thinks it's on page 99.
  const listingParams = { ...params, page: servedPage };

  const hasActiveFilters = Boolean(
    params.material ||
      params.maxPaise !== undefined ||
      params.query ||
      params.sort !== "featured",
  );

  const noun = total === 1 ? "product" : "products";
  const subtitle = params.query
    ? `${total} ${total === 1 ? "result" : "results"} for “${params.query}”`
    : `${total} ${noun}`;

  return (
    <ProductListing
      title={params.query ? "Search results" : "All Jewellery"}
      subtitle={subtitle}
      products={products}
      categories={categories}
      materials={materials}
      params={listingParams}
      hasActiveFilters={hasActiveFilters}
      resetHref={ROUTES.shop}
      pageCount={pageCount}
    />
  );
}

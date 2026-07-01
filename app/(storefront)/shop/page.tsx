import type { Metadata } from "next";
import { ProductListing } from "@/components/storefront/listing/ProductListing";
import { getCategoryTiles, getMaterials, getProducts } from "@/lib/db/queries";
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
      "Browse the full JR Jewellers range of handcrafted artificial bridal jewellery — bridal sets, necklaces, earrings and more.",
  };
}

/**
 * Shop / search landing (TASKS 1.6) — the full catalog with category, material,
 * and price facets plus sort, all driven by URL search params. Also the target
 * of the header search form (`?q=`).
 */
export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = parseListingParams(await searchParams);

  const [products, categories, materials] = await Promise.all([
    getProducts({
      material: params.material,
      maxPaise: params.maxPaise,
      search: params.query,
      sort: params.sort,
    }),
    getCategoryTiles(),
    getMaterials(),
  ]);

  const hasActiveFilters = Boolean(
    params.material ||
      params.maxPaise !== undefined ||
      params.query ||
      params.sort !== "featured",
  );

  const count = products.length;
  const noun = count === 1 ? "product" : "products";
  const subtitle = params.query
    ? `${count} ${count === 1 ? "result" : "results"} for “${params.query}”`
    : `${count} ${noun}`;

  return (
    <ProductListing
      title={params.query ? "Search results" : "All Jewellery"}
      subtitle={subtitle}
      products={products}
      categories={categories}
      materials={materials}
      params={params}
      hasActiveFilters={hasActiveFilters}
      resetHref={ROUTES.shop}
    />
  );
}

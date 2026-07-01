import Link from "next/link";
import { ProductCard } from "@/components/storefront/product/ProductCard";
import type { ProductListItem } from "@/lib/db/queries";
import type { ListingParams } from "@/lib/listing";
import { ROUTES } from "@/lib/routes";
import { FilterSidebar, type CategoryFacet } from "./FilterSidebar";
import { SortSelect } from "./SortSelect";

type ProductListingProps = {
  title: string;
  /** Small line under the title (e.g. result count or search context). */
  subtitle: string;
  products: ProductListItem[];
  categories: CategoryFacet[];
  materials: string[];
  activeCategorySlug?: string;
  params: ListingParams;
  /** True when any facet/sort is applied — drives "Clear all" + reset UI. */
  hasActiveFilters: boolean;
  /** Where "Clear filters" in the empty state points (bare page path). */
  resetHref: string;
};

/**
 * Shared listing surface for `/shop` and `/{category}`, matched to the
 * storefront prototype: a title + count + sort row over a two-column layout
 * (facet sidebar · product grid), with a filtered empty state. All filter and
 * sort state is read from the URL by the calling page; this component only
 * renders it.
 */
export function ProductListing({
  title,
  subtitle,
  products,
  categories,
  materials,
  activeCategorySlug,
  params,
  hasActiveFilters,
  resetHref,
}: ProductListingProps) {
  return (
    <main className="mx-auto max-w-[1280px] flex-1 px-6 pb-[70px] pt-[26px]">
      <nav aria-label="Breadcrumb" className="mb-[22px]">
        <ol className="flex items-center gap-2 text-[12px] leading-none text-[#9C8A84]">
          <li>
            <Link href={ROUTES.home} className="text-maroon-700 hover:underline">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>

      <header className="mb-7 flex flex-wrap items-end justify-between gap-3.5 border-b border-[#E7D9C2] pb-[22px]">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-heading text-[42px] font-semibold leading-none text-maroon-900">
            {title}
          </h1>
          <span className="text-[13px] leading-none text-[#7A655F]">
            {subtitle}
          </span>
        </div>
        <SortSelect value={params.sort} />
      </header>

      <div className="flex flex-col gap-9 lg:flex-row lg:items-start">
        <FilterSidebar
          categories={categories}
          activeCategorySlug={activeCategorySlug}
          materials={materials}
          selectedMaterial={params.material}
          maxRupees={params.maxRupees}
          hasActiveFilters={hasActiveFilters}
        />

        <div className="min-w-0 flex-1">
          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-[22px] sm:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3.5 rounded-md border border-dashed border-[#E0CFB4] bg-cream-50 px-5 py-20 text-center">
              <span className="text-[34px] text-gold-400" aria-hidden>
                ⚲
              </span>
              <p className="m-0 font-heading text-[24px] font-semibold leading-none text-maroon-900">
                No pieces match these filters
              </p>
              <p className="m-0 text-[13px] leading-normal text-[#7A655F]">
                Try widening your price range or clearing filters.
              </p>
              <Link
                href={resetHref}
                className="mt-1.5 rounded-sm bg-maroon-700 px-[26px] py-3 text-[12px] font-semibold uppercase leading-none tracking-[0.12em] text-cream-200 transition-colors hover:bg-maroon-800"
              >
                Reset filters
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

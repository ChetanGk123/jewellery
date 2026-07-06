"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LISTING_PARAMS,
  PRICE_MAX_RUPEES,
  PRICE_MIN_RUPEES,
  PRICE_STEP_RUPEES,
} from "@/lib/listing";
import { ROUTES } from "@/lib/routes";
import { formatPaise } from "@/lib/utils/money";

export type CategoryFacet = {
  slug: string;
  name: string;
  productCount: number;
};

type FilterSidebarProps = {
  categories: CategoryFacet[];
  activeCategorySlug?: string;
  materials: string[];
  selectedMaterial?: string;
  maxRupees: number;
  hasActiveFilters: boolean;
};

/**
 * Facet sidebar for the listing pages: category navigation, a material toggle
 * list, and a max-price slider. Category is a route switch (`/shop` or
 * `/{slug}`); material and price live in the current page's search params so the
 * server component can re-query. "Clear all" drops every param on the page.
 */
export function FilterSidebar({
  categories,
  activeCategorySlug,
  materials,
  selectedMaterial,
  maxRupees,
  hasActiveFilters,
}: FilterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Slider position mirrors the URL; keep a local copy for smooth dragging and
  // resync whenever navigation lands with a different committed value.
  const [priceRupees, setPriceRupees] = useState(maxRupees);
  useEffect(() => setPriceRupees(maxRupees), [maxRupees]);

  // Facets are collapsed behind a disclosure on mobile (TASKS 4.8) — the full
  // stack pushed the product grid ~2 viewports down. Ignored at `lg`, where
  // the sidebar is always visible.
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    // A filter change can invalidate the current page (fewer results, fewer
    // pages) — always land back on page 1 (TASKS 4.17).
    params.delete(LISTING_PARAMS.page);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function toggleMaterial(material: string) {
    pushParams((params) => {
      if (params.get(LISTING_PARAMS.material) === material) {
        params.delete(LISTING_PARAMS.material);
      } else {
        params.set(LISTING_PARAMS.material, material);
      }
    });
  }

  function commitPrice(rupees: number) {
    pushParams((params) => {
      if (rupees >= PRICE_MAX_RUPEES) {
        params.delete(LISTING_PARAMS.maxPrice);
      } else {
        params.set(LISTING_PARAMS.maxPrice, String(rupees));
      }
    });
  }

  function clearAll() {
    router.push(pathname, { scroll: false });
  }

  const priceLabel =
    priceRupees >= PRICE_MAX_RUPEES
      ? "Any price"
      : `Up to ${formatPaise(priceRupees * 100)}`;

  return (
    <aside className="flex w-full flex-col gap-3.5 lg:sticky lg:top-[130px] lg:w-[230px] lg:flex-none lg:gap-[30px]">
      <button
        type="button"
        onClick={() => setIsMobileOpen((open) => !open)}
        aria-expanded={isMobileOpen}
        className="flex items-center justify-between rounded-sm border border-[#E7D9C2] bg-white px-4 py-3 text-[12px] font-semibold uppercase leading-none tracking-[0.1em] text-maroon-900 lg:hidden"
      >
        <span>Filters{hasActiveFilters ? " · Active" : ""}</span>
        <span
          aria-hidden
          className={`text-[10px] transition-transform ${isMobileOpen ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      <div
        className={`flex-col gap-[30px] ${isMobileOpen ? "flex" : "hidden"} lg:flex`}
      >
        <FacetGroup title="Category">
          <FacetRow
            as="link"
            href={ROUTES.shop}
            label="All Jewellery"
            isActive={!activeCategorySlug}
          />
          {categories.map((category) => (
            <FacetRow
              key={category.slug}
              as="link"
              href={ROUTES.category(category.slug)}
              label={category.name}
              count={category.productCount}
              isActive={category.slug === activeCategorySlug}
            />
          ))}
        </FacetGroup>

        {materials.length > 0 && (
          <>
            <Divider />
            <FacetGroup title="Material">
              {materials.map((material) => (
                <FacetRow
                  key={material}
                  as="button"
                  label={material}
                  dot
                  isActive={material === selectedMaterial}
                  onClick={() => toggleMaterial(material)}
                />
              ))}
            </FacetGroup>
          </>
        )}

        <Divider />
        <div className="flex flex-col gap-3.5">
          <div className="text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-maroon-900">
            Price
          </div>
          <input
            type="range"
            min={PRICE_MIN_RUPEES}
            max={PRICE_MAX_RUPEES}
            step={PRICE_STEP_RUPEES}
            value={priceRupees}
            aria-label="Maximum price"
            onChange={(event) => setPriceRupees(Number(event.target.value))}
            onMouseUp={() => commitPrice(priceRupees)}
            onTouchEnd={() => commitPrice(priceRupees)}
            onKeyUp={() => commitPrice(priceRupees)}
            className="w-full cursor-pointer accent-maroon-700"
          />
          <div className="text-[13px] leading-none text-[#7A655F]">
            {priceLabel}
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="self-start p-0 text-[12px] font-medium leading-none tracking-[0.06em] text-gold-600 underline"
          >
            Clear all filters
          </button>
        )}
      </div>
    </aside>
  );
}

function FacetGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-maroon-900">
        {title}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-[#EFE3D0]" aria-hidden />;
}

type FacetRowProps = {
  label: string;
  isActive: boolean;
  count?: number;
  dot?: boolean;
} & (
  | { as: "link"; href: string; onClick?: never }
  | { as: "button"; href?: never; onClick: () => void }
);

/** A single facet entry — a category link or a material toggle button. */
function FacetRow(props: FacetRowProps) {
  const { label, isActive, count, dot } = props;
  const textClass = isActive ? "text-maroon-700" : "text-[#5E4A44]";
  const body = (
    <>
      <span className="flex items-center gap-2">
        {dot && (
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isActive ? "bg-maroon-700" : "bg-[#D8C6A6]"
            }`}
          />
        )}
        <span className={isActive ? "font-medium" : ""}>{label}</span>
      </span>
      {typeof count === "number" && (
        <span className="text-[11px] text-[#B5A39C]">{count}</span>
      )}
    </>
  );

  const shared =
    "flex items-center justify-between gap-2 text-left text-[13.5px] leading-none transition-colors hover:text-maroon-700";

  if (props.as === "link") {
    return (
      <Link
        href={props.href}
        aria-current={isActive ? "true" : undefined}
        className={`${shared} ${textClass}`}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={isActive}
      className={`${shared} ${textClass}`}
    >
      {body}
    </button>
  );
}

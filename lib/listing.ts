import type { ProductSort } from "@/lib/db/queries";

/**
 * Shared listing state: the storefront listing pages (`/shop`, `/{category}`)
 * keep their sort, material, price, and search all in the URL so results are
 * shareable and back/forward works. This module is the single place that reads
 * and validates those params, so pages and the filter UI agree on the shape.
 */

/** URL search-param keys used by the listing pages. */
export const LISTING_PARAMS = {
  sort: "sort",
  material: "material",
  maxPrice: "maxPrice",
  query: "q",
} as const;

/** Price slider bounds, in whole rupees (catalog runs ~₹399–₹4,999). */
export const PRICE_MIN_RUPEES = 400;
export const PRICE_MAX_RUPEES = 5000;
export const PRICE_STEP_RUPEES = 100;

const PAISE_PER_RUPEE = 100;

const VALID_SORTS: readonly ProductSort[] = [
  "featured",
  "newest",
  "price-asc",
  "price-desc",
  "rating",
];

/** Next.js passes each search param as a string, string[], or undefined. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export type ListingParams = {
  sort: ProductSort;
  material?: string;
  /** Upper price bound in paise; absent when the slider is at its max. */
  maxPaise?: number;
  /** Selected max price in rupees, always set — drives the slider position. */
  maxRupees: number;
  query?: string;
};

/** First value of a possibly-repeated param, trimmed; undefined when empty. */
function firstValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function parseSort(value: string | undefined): ProductSort {
  return VALID_SORTS.includes(value as ProductSort)
    ? (value as ProductSort)
    : "featured";
}

/** Clamp the max-price param to the slider bounds; default to the max (no cap). */
function parseMaxRupees(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return PRICE_MAX_RUPEES;
  return Math.min(PRICE_MAX_RUPEES, Math.max(PRICE_MIN_RUPEES, Math.round(parsed)));
}

/** Read and validate the listing params from a page's `searchParams`. */
export function parseListingParams(raw: RawSearchParams): ListingParams {
  const material = firstValue(raw[LISTING_PARAMS.material]);
  const query = firstValue(raw[LISTING_PARAMS.query]);
  const maxRupees = parseMaxRupees(firstValue(raw[LISTING_PARAMS.maxPrice]));
  const capped = maxRupees < PRICE_MAX_RUPEES;

  return {
    sort: parseSort(firstValue(raw[LISTING_PARAMS.sort])),
    material,
    maxPaise: capped ? maxRupees * PAISE_PER_RUPEE : undefined,
    maxRupees,
    query,
  };
}

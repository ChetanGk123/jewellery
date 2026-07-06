import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { PRODUCTS_PAGE_SIZE } from "@/lib/listing";
import { CACHE_TAGS, CATALOG_REVALIDATE_SECONDS } from "./cache";
import { publicClient } from "./public";
import type { Database } from "./types";

/**
 * Storefront data access layer. All reads run server-side against the
 * RLS public-read tables (see TASKS.md Phase 0.0). Prices stay in integer
 * paise — format only in the UI (`lib/utils/money`).
 *
 * Caching (TASKS 4.18): reads go through the cookie-free `publicClient` and
 * are wrapped in `unstable_cache` (arguments become part of the cache key), so
 * a warm request renders without a single Supabase round trip while every page
 * still renders per-request for the nonce CSP. Write paths expire the
 * `CACHE_TAGS` they touch; `CATALOG_REVALIDATE_SECONDS` caps staleness for
 * changes no action sees (e.g. DB triggers).
 */

type ProductRow = Database["public"]["Tables"]["product"]["Row"];

export type Category = Database["public"]["Tables"]["category"]["Row"];
export type ProductImage = Database["public"]["Tables"]["product_image"]["Row"];
export type ProductOption = Database["public"]["Tables"]["product_option"]["Row"];
export type Review = Database["public"]["Tables"]["review"]["Row"];

/**
 * Products in any of these statuses are shown in the storefront. `Draft` is the
 * only hidden state (matches the `product_status_check` constraint).
 */
export const STOREFRONT_VISIBLE_STATUSES = [
  "Active",
  "Low stock",
  "Out of stock",
] as const;

export type ProductSort =
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating";

export type ProductFilters = {
  categorySlug?: string;
  material?: string;
  minPaise?: number;
  maxPaise?: number;
  search?: string;
  featured?: boolean;
  fresh?: boolean;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
};

/** Minimal image shape needed to render a card (real photo or gradient fallback). */
export type ProductImageBrief = { url: string | null; bg: string | null };

/** Product shape for listing/grids. */
export type ProductListItem = Pick<
  ProductRow,
  | "id"
  | "slug"
  | "name"
  | "blurb"
  | "material"
  | "badge"
  | "price_paise"
  | "mrp_paise"
  | "rating"
  | "review_count"
  | "stock"
  | "status"
  | "is_featured"
  | "is_fresh"
  | "primary_image_url"
  | "created_at"
> & {
  category: Pick<Category, "name" | "slug">;
  image: ProductImageBrief | null;
};

/** Full product for the detail page. */
export type ProductDetail = ProductRow & {
  category: Pick<Category, "name" | "slug">;
  images: ProductImage[];
  options: ProductOption[];
};

const LIST_COLUMNS =
  "id, slug, name, blurb, material, badge, price_paise, mrp_paise, rating, review_count, stock, status, is_featured, is_fresh, primary_image_url, created_at";

type EmbeddedImage = {
  url: string | null;
  bg: string | null;
  is_primary: boolean;
  sort_order: number;
};

/** Pick the primary image, falling back to the lowest sort_order, else null. */
function pickPrimaryImage(
  images: EmbeddedImage[] | null | undefined,
): ProductImageBrief | null {
  if (!images || images.length === 0) return null;
  const primary =
    images.find((img) => img.is_primary) ??
    [...images].sort((a, b) => a.sort_order - b.sort_order)[0];
  return { url: primary.url, bg: primary.bg };
}

/** Shared row → `ProductListItem` mapper for `getProducts`/`getProductsPage`. */
function mapProductRows(data: unknown[] | null): ProductListItem[] {
  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown> & {
      images?: EmbeddedImage[] | null;
      category: Pick<Category, "name" | "slug">;
    };
    const { images, category, ...rest } = record;
    return {
      ...(rest as Omit<ProductListItem, "image" | "category">),
      category,
      image: pickPrimaryImage(images),
    };
  });
}

/** All categories, in display order. */
export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const { data, error } = await publicClient
      .from("category")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(`getCategories failed: ${error.message}`);
    }
    return data ?? [];
  },
  ["getCategories"],
  { tags: [CACHE_TAGS.categories], revalidate: CATALOG_REVALIDATE_SECONDS },
);

/** A single category by slug, or null if it doesn't exist. */
export const getCategoryBySlug = unstable_cache(
  async (slug: string): Promise<Category | null> => {
    const { data, error } = await publicClient
      .from("category")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error(`getCategoryBySlug failed: ${error.message}`);
    }
    return data;
  },
  ["getCategoryBySlug"],
  { tags: [CACHE_TAGS.categories], revalidate: CATALOG_REVALIDATE_SECONDS },
);

/**
 * Storefront product listing with optional filters, sort, and pagination.
 * Only returns storefront-visible products (excludes `Draft`).
 */
export const getProducts = unstable_cache(
  async (filters: ProductFilters = {}): Promise<ProductListItem[]> => {
  let query = publicClient
    .from("product")
    .select(
      `${LIST_COLUMNS}, category:category!inner(name, slug), images:product_image(url, bg, is_primary, sort_order)`,
    )
    .in("status", STOREFRONT_VISIBLE_STATUSES);

  if (filters.categorySlug) {
    query = query.eq("category.slug", filters.categorySlug);
  }
  if (filters.material) {
    query = query.eq("material", filters.material);
  }
  if (filters.featured) {
    query = query.eq("is_featured", true);
  }
  if (filters.fresh) {
    query = query.eq("is_fresh", true);
  }
  if (typeof filters.minPaise === "number") {
    query = query.gte("price_paise", filters.minPaise);
  }
  if (typeof filters.maxPaise === "number") {
    query = query.lte("price_paise", filters.maxPaise);
  }
  if (filters.search) {
    query = query.textSearch("search", filters.search, { type: "websearch" });
  }

  applySort(query, filters.sort);

  if (typeof filters.limit === "number") {
    const offset = filters.offset ?? 0;
    query = query.range(offset, offset + filters.limit - 1);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`getProducts failed: ${error.message}`);
  }

  return mapProductRows(data);
  },
  ["getProducts"],
  { tags: [CACHE_TAGS.products], revalidate: CATALOG_REVALIDATE_SECONDS },
);

/** One page of the storefront listing, plus the total count for pagination. */
export type ProductsPage = {
  items: ProductListItem[];
  total: number;
  pageCount: number;
  /** The page actually served — may differ from the requested page if it was
   * clamped into range (e.g. a stale `?page=99` after a filter shrank the
   * result set). */
  page: number;
};

/**
 * Paginated storefront listing (TASKS 4.17) — same filters as `getProducts`,
 * but always ranged to `PRODUCTS_PAGE_SIZE` and paired with an exact total
 * count so `/shop` and category pages never run an unbounded query as the
 * catalog grows. Kept as its own function (some duplicated filter-building
 * with `getProducts`) rather than changing that widely-used function's
 * return shape for its five other unpaginated callers.
 */
export const getProductsPage = unstable_cache(
  async (
    filters: Omit<ProductFilters, "limit" | "offset">,
    page: number,
  ): Promise<ProductsPage> => {
  const supabase = publicClient;
  const pageSize = PRODUCTS_PAGE_SIZE;

  // Count first and clamp the page to it — PostgREST raises "Requested range
  // not satisfiable" (a hard error, not an empty result) when `.range()`'s
  // offset exceeds the total row count, e.g. a stale/hand-edited `?page=99`
  // once a filter has shrunk the result set. Clamping avoids ever asking for
  // an out-of-range offset instead of catching the error after the fact.
  let countQuery = supabase
    .from("product")
    .select("id, category:category!inner(slug)", { count: "exact", head: true })
    .in("status", STOREFRONT_VISIBLE_STATUSES);

  if (filters.categorySlug) {
    countQuery = countQuery.eq("category.slug", filters.categorySlug);
  }
  if (filters.material) {
    countQuery = countQuery.eq("material", filters.material);
  }
  if (filters.featured) {
    countQuery = countQuery.eq("is_featured", true);
  }
  if (filters.fresh) {
    countQuery = countQuery.eq("is_fresh", true);
  }
  if (typeof filters.minPaise === "number") {
    countQuery = countQuery.gte("price_paise", filters.minPaise);
  }
  if (typeof filters.maxPaise === "number") {
    countQuery = countQuery.lte("price_paise", filters.maxPaise);
  }
  if (filters.search) {
    countQuery = countQuery.textSearch("search", filters.search, { type: "websearch" });
  }

  const { count, error: countError } = await countQuery;
  if (countError) {
    throw new Error(`getProductsPage count failed: ${countError.message}`);
  }

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const from = (safePage - 1) * pageSize;

  if (total === 0) {
    return { items: [], total: 0, pageCount: 1, page: 1 };
  }

  let query = supabase
    .from("product")
    .select(
      `${LIST_COLUMNS}, category:category!inner(name, slug), images:product_image(url, bg, is_primary, sort_order)`,
    )
    .in("status", STOREFRONT_VISIBLE_STATUSES);

  if (filters.categorySlug) {
    query = query.eq("category.slug", filters.categorySlug);
  }
  if (filters.material) {
    query = query.eq("material", filters.material);
  }
  if (filters.featured) {
    query = query.eq("is_featured", true);
  }
  if (filters.fresh) {
    query = query.eq("is_fresh", true);
  }
  if (typeof filters.minPaise === "number") {
    query = query.gte("price_paise", filters.minPaise);
  }
  if (typeof filters.maxPaise === "number") {
    query = query.lte("price_paise", filters.maxPaise);
  }
  if (filters.search) {
    query = query.textSearch("search", filters.search, { type: "websearch" });
  }

  applySort(query, filters.sort);
  query = query.range(from, from + pageSize - 1);

  const { data, error } = await query;
  if (error) {
    throw new Error(`getProductsPage failed: ${error.message}`);
  }

  return { items: mapProductRows(data), total, pageCount, page: safePage };
  },
  ["getProductsPage"],
  { tags: [CACHE_TAGS.products], revalidate: CATALOG_REVALIDATE_SECONDS },
);

function applySort<
  T extends {
    order: (
      column: string,
      opts: { ascending: boolean },
    ) => T;
  },
>(query: T, sort: ProductSort = "featured"): T {
  switch (sort) {
    case "price-asc":
      return query.order("price_paise", { ascending: true });
    case "price-desc":
      return query.order("price_paise", { ascending: false });
    case "rating":
      return query
        .order("rating", { ascending: false })
        .order("review_count", { ascending: false });
    case "newest":
      return query.order("created_at", { ascending: false });
    case "featured":
    default:
      return query
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
  }
}

/** Featured ("Most Loved") products for the home page, newest first. */
export async function getFeaturedProducts(
  limit = 8,
): Promise<ProductListItem[]> {
  return getProducts({ featured: true, sort: "newest", limit });
}

/** Freshly-added ("New Arrivals") products for the home page, newest first. */
export async function getFreshProducts(limit = 8): Promise<ProductListItem[]> {
  return getProducts({ fresh: true, sort: "newest", limit });
}

/**
 * Distinct materials across storefront-visible products, alphabetically. Powers
 * the Material facet on the listing pages. Small catalog, so a slim scan is
 * fine; revisit with a dedicated view if the product table grows large.
 */
export const getMaterials = unstable_cache(
  async (): Promise<string[]> => {
    const { data, error } = await publicClient
      .from("product")
      .select("material")
      .in("status", STOREFRONT_VISIBLE_STATUSES)
      .not("material", "is", null);

    if (error) {
      throw new Error(`getMaterials failed: ${error.message}`);
    }

    const materials = new Set<string>();
    for (const row of data ?? []) {
      if (row.material) materials.add(row.material);
    }
    return [...materials].sort((a, b) => a.localeCompare(b));
  },
  ["getMaterials"],
  { tags: [CACHE_TAGS.products], revalidate: CATALOG_REVALIDATE_SECONDS },
);

/** A category plus its count of storefront-visible products (for home tiles). */
export type CategoryTile = Category & { productCount: number };

/**
 * Categories in display order, each with a visible-product count for the
 * "{n} styles" label on the home page tiles. Counts are tallied from a slim
 * `category_id` scan (fine at catalog scale; revisit if products grow large).
 */
export const getCategoryTiles = unstable_cache(
  async (): Promise<CategoryTile[]> => {
    const [cats, counts] = await Promise.all([
      publicClient
        .from("category")
        .select("*")
        .order("sort_order", { ascending: true }),
      publicClient
        .from("product")
        .select("category_id")
        .in("status", STOREFRONT_VISIBLE_STATUSES),
    ]);

    if (cats.error) {
      throw new Error(`getCategoryTiles failed: ${cats.error.message}`);
    }
    if (counts.error) {
      throw new Error(`getCategoryTiles counts failed: ${counts.error.message}`);
    }

    const tally = new Map<string, number>();
    for (const row of counts.data ?? []) {
      tally.set(row.category_id, (tally.get(row.category_id) ?? 0) + 1);
    }

    return (cats.data ?? []).map((category) => ({
      ...category,
      productCount: tally.get(category.id) ?? 0,
    }));
  },
  ["getCategoryTiles"],
  // Counts products per category, so both facets of the data apply.
  {
    tags: [CACHE_TAGS.categories, CACHE_TAGS.products],
    revalidate: CATALOG_REVALIDATE_SECONDS,
  },
);

/**
 * Full product by slug, or null if not found / not storefront-visible.
 * Also `React.cache`d: `generateMetadata` and the page body both call it in
 * the same request, so the second call reuses the first's in-flight result.
 */
export const getProductBySlug = cache(
  unstable_cache(
    async (slug: string): Promise<ProductDetail | null> => {
      const { data, error } = await publicClient
        .from("product")
        .select(
          "*, category:category(name, slug), images:product_image(*), options:product_option(*)",
        )
        .eq("slug", slug)
        .in("status", STOREFRONT_VISIBLE_STATUSES)
        .maybeSingle();

      if (error) {
        throw new Error(`getProductBySlug failed: ${error.message}`);
      }
      if (!data) return null;

      const record = data as unknown as ProductDetail;
      return {
        ...record,
        images: [...(record.images ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
        options: [...(record.options ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
      };
    },
    ["getProductBySlug"],
    { tags: [CACHE_TAGS.products], revalidate: CATALOG_REVALIDATE_SECONDS },
  ),
);

/**
 * Products related to the given one — same category, excluding the current
 * slug — for the "You may also love" rail on the detail page. Fetches one extra
 * so removing the current product still leaves a full row.
 */
export async function getRelatedProducts(
  categorySlug: string,
  excludeSlug: string,
  limit = 4,
): Promise<ProductListItem[]> {
  const products = await getProducts({
    categorySlug,
    sort: "featured",
    limit: limit + 1,
  });
  return products.filter((p) => p.slug !== excludeSlug).slice(0, limit);
}

/** Approved reviews for a product, newest first. */
export const getApprovedReviews = unstable_cache(
  async (productId: string): Promise<Review[]> => {
    const { data, error } = await publicClient
      .from("review")
      .select("*")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`getApprovedReviews failed: ${error.message}`);
    }
    return data ?? [];
  },
  ["getApprovedReviews"],
  { tags: [CACHE_TAGS.reviews], revalidate: CATALOG_REVALIDATE_SECONDS },
);

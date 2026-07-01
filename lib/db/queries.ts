import "server-only";
import { createServerClient } from "./server";
import type { Database } from "./types";

/**
 * Storefront data access layer. All reads run server-side against the
 * RLS public-read tables (see TASKS.md Phase 0.0). Prices stay in integer
 * paise — format only in the UI (`lib/utils/money`).
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

/** All categories, in display order. */
export async function getCategories(): Promise<Category[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("category")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`getCategories failed: ${error.message}`);
  }
  return data ?? [];
}

/** A single category by slug, or null if it doesn't exist. */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("category")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`getCategoryBySlug failed: ${error.message}`);
  }
  return data;
}

/**
 * Storefront product listing with optional filters, sort, and pagination.
 * Only returns storefront-visible products (excludes `Draft`).
 */
export async function getProducts(
  filters: ProductFilters = {},
): Promise<ProductListItem[]> {
  const supabase = createServerClient();

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

  if (typeof filters.limit === "number") {
    const offset = filters.offset ?? 0;
    query = query.range(offset, offset + filters.limit - 1);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`getProducts failed: ${error.message}`);
  }

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

/** A category plus its count of storefront-visible products (for home tiles). */
export type CategoryTile = Category & { productCount: number };

/**
 * Categories in display order, each with a visible-product count for the
 * "{n} styles" label on the home page tiles. Counts are tallied from a slim
 * `category_id` scan (fine at catalog scale; revisit if products grow large).
 */
export async function getCategoryTiles(): Promise<CategoryTile[]> {
  const supabase = createServerClient();
  const [cats, counts] = await Promise.all([
    supabase.from("category").select("*").order("sort_order", { ascending: true }),
    supabase
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
}

/** Full product by slug, or null if not found / not storefront-visible. */
export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
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
}

/** Approved reviews for a product, newest first. */
export async function getApprovedReviews(
  productId: string,
): Promise<Review[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("review")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`getApprovedReviews failed: ${error.message}`);
  }
  return data ?? [];
}

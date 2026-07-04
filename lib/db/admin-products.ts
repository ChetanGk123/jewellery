import "server-only";
import {
  ADMIN_PRODUCTS_PAGE_SIZE,
  PRODUCT_STATUS_FILTERS,
  type ProductStatusFilter,
} from "@/lib/admin/product-status";
import { createServerClient } from "./server";

/**
 * Admin catalogue (Phase 3.4). Reads `product` + `category` through the admin's
 * cookie session. `product` is publicly readable, so this sees Draft rows too
 * (the storefront hides them in app code). Each row carries every editable
 * field so the edit modal prefills without a second round-trip. Writes go
 * through the `admin_upsert_product` RPC (0008), never a direct table write.
 */

export type AdminCategory = { id: string; name: string };

export type AdminProductRow = {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  pricePaise: number;
  mrpPaise: number | null;
  stock: number;
  status: string;
  imageUrl: string | null;
  material: string | null;
  badge: string;
  blurb: string | null;
  descLong: string | null;
  detailsPlating: string | null;
  detailsStones: string | null;
  detailsCare: string | null;
  shippingNote: string | null;
  isFeatured: boolean;
  isFresh: boolean;
};

export type AdminProductsPage = {
  rows: AdminProductRow[];
  categories: AdminCategory[];
  search: string;
  categoryId: string; // "All" or a category uuid
  status: ProductStatusFilter;
  page: number;
  pageCount: number;
  total: number;
};

const LOW_STOCK_THRESHOLD = 5;

const SELECT =
  "id, name, sku, category_id, price_paise, mrp_paise, stock, status, primary_image_url, material, badge, blurb, desc_long, details_plating, details_stones, details_care, shipping_note, is_featured, is_fresh, category(name)";

/** Coerce an untrusted `?status=` value to a valid filter. */
export function toProductStatusFilter(
  value: string | undefined,
): ProductStatusFilter {
  return value && (PRODUCT_STATUS_FILTERS as readonly string[]).includes(value)
    ? (value as ProductStatusFilter)
    : "All";
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("category")
      .select("id, name")
      .order("sort_order", { ascending: true });
    return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
  } catch {
    return [];
  }
}

export async function listAdminProducts(opts: {
  search: string;
  categoryId: string;
  status: ProductStatusFilter;
  page: number;
}): Promise<AdminProductsPage> {
  const { search, categoryId, status } = opts;
  const page = Math.max(1, opts.page);
  const from = (page - 1) * ADMIN_PRODUCTS_PAGE_SIZE;

  const empty: AdminProductsPage = {
    rows: [],
    categories: [],
    search,
    categoryId,
    status,
    page,
    pageCount: 1,
    total: 0,
  };

  try {
    const supabase = await createServerClient();

    let query = supabase
      .from("product")
      .select(SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + ADMIN_PRODUCTS_PAGE_SIZE - 1);

    if (search.trim()) {
      const q = search.trim().replace(/[%,]/g, " ");
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    }
    if (categoryId !== "All") query = query.eq("category_id", categoryId);

    // Status filter is a hybrid of stored status and stock level.
    if (status === "Active") query = query.eq("status", "Active");
    else if (status === "Draft") query = query.eq("status", "Draft");
    else if (status === "Low stock")
      query = query.gt("stock", 0).lte("stock", LOW_STOCK_THRESHOLD);
    else if (status === "Out of stock") query = query.lte("stock", 0);

    const [{ data, count }, categories] = await Promise.all([
      query,
      getAdminCategories(),
    ]);

    const total = count ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / ADMIN_PRODUCTS_PAGE_SIZE));

    const rows: AdminProductRow[] = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      categoryId: p.category_id,
      categoryName: p.category?.name ?? "—",
      pricePaise: p.price_paise,
      mrpPaise: p.mrp_paise,
      stock: p.stock,
      status: p.status,
      imageUrl: p.primary_image_url,
      material: p.material,
      badge: p.badge,
      blurb: p.blurb,
      descLong: p.desc_long,
      detailsPlating: p.details_plating,
      detailsStones: p.details_stones,
      detailsCare: p.details_care,
      shippingNote: p.shipping_note,
      isFeatured: p.is_featured,
      isFresh: p.is_fresh,
    }));

    return {
      rows,
      categories,
      search,
      categoryId,
      status,
      page,
      pageCount,
      total,
    };
  } catch {
    return empty;
  }
}

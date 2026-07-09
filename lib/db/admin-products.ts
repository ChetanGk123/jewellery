import "server-only"
import {
  ADMIN_PRODUCTS_PAGE_SIZE,
  PRODUCT_STATUS_FILTERS,
  type ProductImage,
  type ProductStatusFilter,
} from "@/lib/admin/product-status"
import { type AdminRead, loadAdmin } from "./admin-read"
import { createServerClient } from "./server"

/** Coerce the stored `gallery` jsonb into a clean ProductImage[]. */
function parseGallery(raw: unknown): ProductImage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      url: typeof x.url === "string" ? x.url : "",
      name: typeof x.name === "string" ? x.name : "",
      primary: x.primary === true,
    }))
}

/**
 * Admin catalogue (Phase 3.4). Reads `product` + `category` through the admin's
 * cookie session. `product` is publicly readable, so this sees Draft rows too
 * (the storefront hides them in app code). Each row carries every editable
 * field so the edit modal prefills without a second round-trip. Writes go
 * through the `admin_upsert_product` RPC (0008), never a direct table write.
 */

export type AdminCategory = { id: string; name: string }

export type AdminProductRow = {
  id: string
  name: string
  /** Storefront URL slug — powers the "view on storefront" link (5.18). */
  slug: string
  sku: string
  categoryId: string
  categoryName: string
  pricePaise: number
  mrpPaise: number | null
  stock: number
  status: string
  imageUrl: string | null
  material: string | null
  badge: string
  blurb: string | null
  descLong: string | null
  detailsPlating: string | null
  detailsStones: string | null
  detailsCare: string | null
  shippingNote: string | null
  isFeatured: boolean
  isFresh: boolean
  gallery: ProductImage[]
  platingOptions: string[]
}

export type AdminProductsPage = {
  rows: AdminProductRow[]
  categories: AdminCategory[]
  search: string
  categoryId: string // "All" or a category uuid
  status: ProductStatusFilter
  page: number
  pageCount: number
  total: number
}

const LOW_STOCK_THRESHOLD = 5

const SELECT =
  "id, name, slug, sku, category_id, price_paise, mrp_paise, stock, status, primary_image_url, gallery, plating_options, material, badge, blurb, desc_long, details_plating, details_stones, details_care, shipping_note, is_featured, is_fresh, category(name)"

/** The `SELECT` shape; `category` embeds as an object (or a 1-row array). */
type ProductSelectRow = {
  id: string
  name: string
  slug: string
  sku: string
  category_id: string
  price_paise: number
  mrp_paise: number | null
  stock: number
  status: string
  primary_image_url: string | null
  gallery: unknown
  plating_options: string[] | null
  material: string | null
  badge: string
  blurb: string | null
  desc_long: string | null
  details_plating: string | null
  details_stones: string | null
  details_care: string | null
  shipping_note: string | null
  is_featured: boolean
  is_fresh: boolean
  category: { name: string } | { name: string }[] | null
}

function categoryName(category: ProductSelectRow["category"]): string {
  if (Array.isArray(category)) return category[0]?.name ?? "—"
  return category?.name ?? "—"
}

/** Map a `SELECT` row to the camelCase `AdminProductRow` the console/modal use. */
function mapProductRow(p: ProductSelectRow): AdminProductRow {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    categoryId: p.category_id,
    categoryName: categoryName(p.category),
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
    gallery: parseGallery(p.gallery),
    platingOptions: Array.isArray(p.plating_options) ? p.plating_options : [],
  }
}

/**
 * One product by id (Phase 3.10 → 3.4 deep link). Lets the products page open a
 * specific product's edit modal via `?edit=<id>` even when that product isn't on
 * the current list page. Returns null if it's missing.
 */
export async function getAdminProductById(id: string): Promise<AdminProductRow | null> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase.from("product").select(SELECT).eq("id", id).maybeSingle()
    return data ? mapProductRow(data as ProductSelectRow) : null
  } catch (err) {
    console.error("[admin-read] product-by-id failed:", err)
    return null
  }
}

/** Cap on rows in the bulk .xlsx export (well above the current catalogue). */
const EXPORT_PRODUCTS_CAP = 5000

/**
 * Every product for the bulk .xlsx export and the import's diff context —
 * the list itself paginates, so this reads the lot on demand (admin gate is
 * the caller's job, mirroring `getAllOrdersForExport`).
 */
export async function getAllProductsForExport(): Promise<AdminProductRow[]> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from("product")
      .select(SELECT)
      .order("name", { ascending: true })
      .limit(EXPORT_PRODUCTS_CAP)
    return ((data ?? []) as ProductSelectRow[]).map(mapProductRow)
  } catch (err) {
    console.error("[admin-read] products export failed:", err)
    return []
  }
}

/** Coerce an untrusted `?status=` value to a valid filter. */
export function toProductStatusFilter(value: string | undefined): ProductStatusFilter {
  return value && (PRODUCT_STATUS_FILTERS as readonly string[]).includes(value)
    ? (value as ProductStatusFilter)
    : "All"
}

export async function getAdminCategories(): Promise<AdminCategory[]> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from("category")
      .select("id, name")
      .order("sort_order", { ascending: true })
    return (data ?? []).map((c) => ({ id: c.id, name: c.name }))
  } catch (err) {
    console.error("[admin-read] product-categories failed:", err)
    return []
  }
}

export async function listAdminProducts(opts: {
  search: string
  categoryId: string
  status: ProductStatusFilter
  page: number
}): Promise<AdminRead<AdminProductsPage>> {
  const { search, categoryId, status } = opts
  const page = Math.max(1, opts.page)
  const from = (page - 1) * ADMIN_PRODUCTS_PAGE_SIZE

  const empty: AdminProductsPage = {
    rows: [],
    categories: [],
    search,
    categoryId,
    status,
    page,
    pageCount: 1,
    total: 0,
  }

  return loadAdmin(
    "products",
    async () => {
      const supabase = await createServerClient()

      let query = supabase
        .from("product")
        .select(SELECT, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + ADMIN_PRODUCTS_PAGE_SIZE - 1)

      if (search.trim()) {
        const q = search.trim().replace(/[%,]/g, " ")
        query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
      }
      if (categoryId !== "All") query = query.eq("category_id", categoryId)

      // Status filter is a hybrid of stored status and stock level.
      if (status === "Active") query = query.eq("status", "Active")
      else if (status === "Draft") query = query.eq("status", "Draft")
      else if (status === "Low stock")
        query = query.gt("stock", 0).lte("stock", LOW_STOCK_THRESHOLD)
      else if (status === "Out of stock") query = query.lte("stock", 0)

      const [{ data, count }, categories] = await Promise.all([query, getAdminCategories()])

      const total = count ?? 0
      const pageCount = Math.max(1, Math.ceil(total / ADMIN_PRODUCTS_PAGE_SIZE))

      const rows: AdminProductRow[] = (data ?? []).map(mapProductRow)

      return {
        rows,
        categories,
        search,
        categoryId,
        status,
        page,
        pageCount,
        total,
      }
    },
    empty,
  )
}

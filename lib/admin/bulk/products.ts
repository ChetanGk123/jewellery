/**
 * Products sheet: column spec, export serialization, and import planning.
 * Pure module (no server imports) so the whole parse path is Bun-testable.
 * Import payloads carry exactly the keys `admin_upsert_product` expects —
 * the same shape `upsertProduct` in products/actions.ts sends.
 */

import type { AdminCategory, AdminProductRow } from "@/lib/db/admin-products"
import { MAX_PLATING_OPTION_LEN, MAX_PLATING_OPTIONS } from "@/lib/admin/product-status"
import { pricePairFromRupees, rupeesFromPricePair } from "@/lib/utils/money"
import {
  type BulkColumn,
  type ImportPlan,
  type PlannedRow,
  type RawRow,
  type RowError,
  blankAsEmpty,
  cellBool,
  cellId,
  cellNumber,
  cellText,
} from "./types"

export const PRODUCTS_SHEET = "Products"

export const PRODUCT_COLUMNS: BulkColumn[] = [
  { header: "ID", text: true, width: 38 },
  { header: "Name", width: 32 },
  { header: "SKU", text: true, width: 14 },
  { header: "Category", dropdown: "categories", width: 18 },
  { header: "Price (₹)", width: 12 },
  { header: "Sale price (₹)", width: 14 },
  { header: "Stock", width: 8 },
  { header: "Status", dropdown: "status", width: 10 },
  { header: "Badge", width: 12 },
  { header: "Blurb", width: 30 },
  { header: "Description", width: 40 },
  { header: "Material", width: 18 },
  { header: "Plating options", width: 30 },
  { header: "Details — Plating", width: 24 },
  { header: "Details — Stones", width: 24 },
  { header: "Details — Care", width: 24 },
  { header: "Shipping note", width: 24 },
  { header: "Featured", dropdown: "bool", width: 10 },
  { header: "Fresh", dropdown: "bool", width: 10 },
  { header: "Slug", readOnly: true, width: 24 },
  { header: "Primary image URL", readOnly: true, width: 40 },
  { header: "Image count", readOnly: true, width: 12 },
]

const MAX_NAME_LEN = 120
/** Separator for the plating-options cell, e.g. "Gold tone | Rose gold". */
const PIPE = /\s*\|\s*/

/** One exported sheet row, aligned with PRODUCT_COLUMNS. */
export function serializeProductRow(row: AdminProductRow): Array<string | number | boolean> {
  const { priceRupees, saleRupees } = rupeesFromPricePair(row.pricePaise, row.mrpPaise)
  return [
    row.id,
    row.name,
    row.sku,
    row.categoryName,
    priceRupees,
    saleRupees ?? "",
    row.stock,
    row.status,
    row.badge,
    blankAsEmpty(row.blurb),
    blankAsEmpty(row.descLong),
    blankAsEmpty(row.material),
    row.platingOptions.join(" | "),
    blankAsEmpty(row.detailsPlating),
    blankAsEmpty(row.detailsStones),
    blankAsEmpty(row.detailsCare),
    blankAsEmpty(row.shippingNote),
    row.isFeatured,
    row.isFresh,
    row.slug,
    blankAsEmpty(row.imageUrl),
    row.gallery.length,
  ]
}

/** The RPC payload derived from an existing row, for unchanged-diffing. */
function payloadFromExisting(row: AdminProductRow): Record<string, unknown> {
  return {
    name: row.name,
    sku: row.sku,
    category_id: row.categoryId,
    price_paise: row.pricePaise,
    mrp_paise: row.mrpPaise,
    stock: row.stock,
    status: row.status,
    plating_options: row.platingOptions,
    material: blankAsEmpty(row.material),
    badge: row.badge,
    blurb: blankAsEmpty(row.blurb),
    desc_long: blankAsEmpty(row.descLong),
    details_plating: blankAsEmpty(row.detailsPlating),
    details_stones: blankAsEmpty(row.detailsStones),
    details_care: blankAsEmpty(row.detailsCare),
    shipping_note: blankAsEmpty(row.shippingNote),
    is_featured: row.isFeatured,
    is_fresh: row.isFresh,
  }
}

function samePayload(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  for (const key of Object.keys(b)) {
    const x = a[key]
    const y = b[key]
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.join(" ") !== y.join(" ")) return false
    } else if (x !== y) {
      return false
    }
  }
  return true
}

export type ProductsImportContext = {
  categories: AdminCategory[]
  existing: AdminProductRow[]
}

/**
 * Validate every sheet row and classify it as create / update / unchanged.
 * Never writes — both the preview and the apply step run this same plan, so
 * what the admin confirms is exactly what the RPC receives. Matching is
 * strictly by ID (decision 5): unknown IDs and duplicate SKUs are row errors,
 * never silent creates.
 */
export function planProductsImport(rows: RawRow[], ctx: ProductsImportContext): ImportPlan {
  const errors: RowError[] = []
  const planned: PlannedRow[] = []
  let creates = 0
  let updates = 0
  let unchanged = 0

  const categoriesByName = new Map(ctx.categories.map((c) => [c.name.trim().toLowerCase(), c.id]))
  const existingById = new Map(ctx.existing.map((p) => [p.id, p]))
  const productIdBySku = new Map(ctx.existing.map((p) => [p.sku.toLowerCase(), p.id]))
  const seenIds = new Set<string>()
  const seenSkus = new Set<string>()

  for (const row of rows) {
    const { rowNum, cells } = row
    const fail = (column: string, message: string) => errors.push({ rowNum, column, message })
    const before = errors.length

    const id = cellId(cells["ID"])
    if (id === undefined) fail("ID", "Not a valid product ID — leave blank to create.")
    if (id) {
      if (seenIds.has(id)) fail("ID", "This ID appears more than once in the sheet.")
      else if (!existingById.has(id)) {
        fail("ID", "No product has this ID — the sheet may be stale. Re-export and retry.")
      }
      seenIds.add(id)
    }
    const existing = id ? existingById.get(id) : undefined

    const name = cellText(cells["Name"])
    if (!name) fail("Name", "Product name is required.")
    else if (name.length > MAX_NAME_LEN) fail("Name", `Name is over ${MAX_NAME_LEN} characters.`)

    const sku = cellText(cells["SKU"])
    if (!sku) fail("SKU", "SKU is required.")
    else {
      const skuKey = sku.toLowerCase()
      const ownerId = productIdBySku.get(skuKey)
      if (seenSkus.has(skuKey)) fail("SKU", "This SKU appears more than once in the sheet.")
      else if (ownerId && ownerId !== (id ?? "")) {
        fail("SKU", "Another product already uses this SKU — edit that row via its ID instead.")
      }
      seenSkus.add(skuKey)
    }

    const categoryName = cellText(cells["Category"])
    const categoryId = categoriesByName.get(categoryName.toLowerCase())
    if (!categoryName) fail("Category", "Category is required.")
    else if (!categoryId) fail("Category", `Unknown category "${categoryName}".`)

    const price = cellNumber(cells["Price (₹)"])
    if (price == null || price <= 0) fail("Price (₹)", "Enter a price above zero.")

    const saleRaw = cellText(cells["Sale price (₹)"])
    const sale = saleRaw ? cellNumber(cells["Sale price (₹)"]) : null
    if (saleRaw && (sale == null || sale < 0)) fail("Sale price (₹)", "Enter a valid sale price.")

    const stock = cellNumber(cells["Stock"])
    if (stock == null || !Number.isInteger(stock) || stock < 0) {
      fail("Stock", "Stock must be a whole number of 0 or more.")
    }

    const statusRaw = cellText(cells["Status"])
    const status =
      statusRaw.toLowerCase() === "draft"
        ? "Draft"
        : statusRaw === "" || statusRaw.toLowerCase() === "active"
          ? "Active"
          : null
    if (!status) fail("Status", `Status must be Active or Draft, not "${statusRaw}".`)

    const plating = [
      ...new Set(
        cellText(cells["Plating options"])
          .split(PIPE)
          .map((opt) => opt.trim())
          .filter(Boolean),
      ),
    ]
    if (plating.length > MAX_PLATING_OPTIONS) {
      fail("Plating options", `At most ${MAX_PLATING_OPTIONS} plating options.`)
    }
    if (plating.some((opt) => opt.length > MAX_PLATING_OPTION_LEN)) {
      fail("Plating options", `Each option must be ${MAX_PLATING_OPTION_LEN} characters or less.`)
    }

    const isFeatured = cellBool(cells["Featured"])
    if (isFeatured == null) fail("Featured", "Use TRUE or FALSE.")
    const isFresh = cellBool(cells["Fresh"])
    if (isFresh == null) fail("Fresh", "Use TRUE or FALSE.")

    if (errors.length > before) continue

    const { pricePaise, mrpPaise } = pricePairFromRupees(price as number, sale)
    const payload: Record<string, unknown> = {
      name,
      sku,
      category_id: categoryId,
      price_paise: pricePaise,
      mrp_paise: mrpPaise,
      stock,
      status,
      plating_options: plating,
      material: cellText(cells["Material"]),
      badge: cellText(cells["Badge"]) || "None",
      blurb: cellText(cells["Blurb"]),
      desc_long: cellText(cells["Description"]),
      details_plating: cellText(cells["Details — Plating"]),
      details_stones: cellText(cells["Details — Stones"]),
      details_care: cellText(cells["Details — Care"]),
      shipping_note: cellText(cells["Shipping note"]),
      is_featured: isFeatured,
      is_fresh: isFresh,
    }

    if (existing) {
      if (samePayload(payload, payloadFromExisting(existing))) {
        unchanged += 1
        continue
      }
      // Images are never sheet-editable, but the RPC writes them from the
      // payload unconditionally — carry the current values through untouched.
      payload.primary_image_url = blankAsEmpty(existing.imageUrl)
      payload.gallery = existing.gallery
      updates += 1
    } else {
      payload.primary_image_url = ""
      payload.gallery = []
      creates += 1
    }

    planned.push({ rowNum, id: id ?? null, payload })
  }

  return {
    rows: planned,
    preview: { creates, updates, unchanged, totalRows: rows.length, errors },
  }
}

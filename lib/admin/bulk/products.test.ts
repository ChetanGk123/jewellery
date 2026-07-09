import { test, expect } from "bun:test"
import type { AdminProductRow } from "@/lib/db/admin-products"
import { PRODUCT_COLUMNS, planProductsImport, serializeProductRow } from "./products"
import type { RawRow } from "./types"

const CATEGORY = { id: "11111111-1111-4111-8111-111111111111", name: "Bridal Sets" }
const OTHER_CATEGORY = { id: "22222222-2222-4222-8222-222222222222", name: "Rings" }

const PRODUCT: AdminProductRow = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Kundan Bridal Set",
  slug: "kundan-bridal-set",
  sku: "JR-001",
  categoryId: CATEGORY.id,
  categoryName: CATEGORY.name,
  pricePaise: 249900,
  mrpPaise: 349900,
  stock: 12,
  status: "Active",
  imageUrl: "https://cdn.example.com/kundan.jpg",
  material: "Brass",
  badge: "Bestseller",
  blurb: "A blurb",
  descLong: null,
  detailsPlating: "22k gold tone",
  detailsStones: null,
  detailsCare: "Keep dry",
  shippingNote: null,
  isFeatured: true,
  isFresh: false,
  gallery: [{ url: "https://cdn.example.com/kundan.jpg", name: "Front", primary: true }],
  platingOptions: ["Gold tone", "Rose gold"],
}

const CTX = { categories: [CATEGORY, OTHER_CATEGORY], existing: [PRODUCT] }

/** Sheet row built from serialized values (optionally overridden by header). */
function rawRow(overrides: Record<string, unknown> = {}, rowNum = 2): RawRow {
  const values = serializeProductRow(PRODUCT)
  const cells = Object.fromEntries(PRODUCT_COLUMNS.map((c, i) => [c.header, values[i]]))
  return { rowNum, cells: { ...cells, ...overrides } }
}

test("serialize → parse round-trip of an untouched row is unchanged", () => {
  const plan = planProductsImport([rawRow()], CTX)
  expect(plan.preview).toEqual({
    creates: 0,
    updates: 0,
    unchanged: 1,
    totalRows: 1,
    errors: [],
  })
  expect(plan.rows).toEqual([])
})

test("edited price becomes an update whose payload carries current images", () => {
  const plan = planProductsImport([rawRow({ "Price (₹)": 3999, "Sale price (₹)": "" })], CTX)
  expect(plan.preview.updates).toBe(1)
  expect(plan.preview.errors).toEqual([])
  const [row] = plan.rows
  expect(row.id).toBe(PRODUCT.id)
  expect(row.payload).toMatchObject({
    price_paise: 399900,
    mrp_paise: null,
    // The gallery-wipe pin: updates MUST pass current images through.
    primary_image_url: PRODUCT.imageUrl,
    gallery: PRODUCT.gallery,
  })
})

test("sale below price maps to price_paise + strike-through MRP", () => {
  const plan = planProductsImport([rawRow({ "Price (₹)": 4000, "Sale price (₹)": 2999 })], CTX)
  expect(plan.rows[0]?.payload).toMatchObject({ price_paise: 299900, mrp_paise: 400000 })
})

test("blank ID with a fresh SKU creates, with empty images", () => {
  const plan = planProductsImport(
    [rawRow({ ID: "", SKU: "JR-002", Name: "New Ring", Category: "rings" })],
    CTX,
  )
  expect(plan.preview.creates).toBe(1)
  const [row] = plan.rows
  expect(row.id).toBeNull()
  expect(row.payload).toMatchObject({
    category_id: OTHER_CATEGORY.id, // case-insensitive category resolution
    primary_image_url: "",
    gallery: [],
  })
})

test("plating options parse from pipes with trim + dedupe", () => {
  const plan = planProductsImport(
    [rawRow({ "Plating options": " Gold tone |Rose gold| Gold tone " })],
    CTX,
  )
  // Same set as the fixture → unchanged, proving normalization matches.
  expect(plan.preview.unchanged).toBe(1)
})

test("boolean cells accept yes/no and TRUE/FALSE", () => {
  const plan = planProductsImport([rawRow({ Featured: "no", Fresh: "TRUE" })], CTX)
  expect(plan.rows[0]?.payload).toMatchObject({ is_featured: false, is_fresh: true })
})

test("row errors: unknown ID, dup SKU in sheet, unknown category, bad status", () => {
  const staleId = rawRow({ ID: "99999999-9999-4999-8999-999999999999", SKU: "JR-009" }, 2)
  const dupSku = rawRow({ ID: "", SKU: "JR-001" }, 3) // JR-001 belongs to PRODUCT
  const badCategory = rawRow({ ID: "", SKU: "JR-010", Category: "Ringz" }, 4)
  const badStatus = rawRow({ ID: "", SKU: "JR-011", Status: "Hidden" }, 5)

  const plan = planProductsImport([staleId, dupSku, badCategory, badStatus], CTX)
  expect(plan.rows).toEqual([])
  const byRow = new Map(plan.preview.errors.map((e) => [e.rowNum, e]))
  expect(byRow.get(2)?.column).toBe("ID")
  expect(byRow.get(3)?.column).toBe("SKU")
  expect(byRow.get(4)?.column).toBe("Category")
  expect(byRow.get(5)?.column).toBe("Status")
})

test("read-only columns are ignored on import", () => {
  const plan = planProductsImport(
    [rawRow({ Slug: "hacked-slug", "Primary image URL": "https://evil.example.com/x.jpg" })],
    CTX,
  )
  // Only read-only columns differ → still unchanged, nothing planned.
  expect(plan.preview.unchanged).toBe(1)
  expect(plan.rows).toEqual([])
})

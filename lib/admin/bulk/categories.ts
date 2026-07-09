/**
 * Categories sheet: column spec, export serialization, and import planning.
 * Pure module — payloads carry exactly the keys `admin_upsert_category`
 * expects (the same shape `upsertCategory` in categories/actions.ts sends).
 */

import type { AdminCategoryRow } from "@/lib/admin/category"
import {
  type BulkColumn,
  type ImportPlan,
  type PlannedRow,
  type RawRow,
  type RowError,
  blankAsEmpty,
  cellId,
  cellText,
} from "./types"

export const CATEGORIES_SHEET = "Categories"

export const CATEGORY_COLUMNS: BulkColumn[] = [
  { header: "ID", text: true, width: 38 },
  { header: "Name", width: 26 },
  { header: "Description", width: 44 },
  { header: "Image URL", width: 50 },
  { header: "Slug", readOnly: true, width: 22 },
  { header: "Sort order", readOnly: true, width: 10 },
  { header: "Product count", readOnly: true, width: 13 },
]

/** Mirrors 0035's INVALID_IMAGE_URL rule: blank clears, else http(s), ≤500. */
const IMAGE_URL_RE = /^https?:\/\/\S+$/
const MAX_IMAGE_URL_LEN = 500

/** One exported sheet row, aligned with CATEGORY_COLUMNS. */
export function serializeCategoryRow(row: AdminCategoryRow): Array<string | number> {
  return [
    row.id,
    row.name,
    blankAsEmpty(row.description),
    blankAsEmpty(row.imageUrl),
    row.slug,
    row.sortOrder,
    row.productCount,
  ]
}

export type CategoriesImportContext = {
  existing: AdminCategoryRow[]
}

/** Validate and classify category rows; see planProductsImport for the model. */
export function planCategoriesImport(rows: RawRow[], ctx: CategoriesImportContext): ImportPlan {
  const errors: RowError[] = []
  const planned: PlannedRow[] = []
  let creates = 0
  let updates = 0
  let unchanged = 0

  const existingById = new Map(ctx.existing.map((c) => [c.id, c]))
  const categoryIdByName = new Map(ctx.existing.map((c) => [c.name.trim().toLowerCase(), c.id]))
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  for (const row of rows) {
    const { rowNum, cells } = row
    const fail = (column: string, message: string) => errors.push({ rowNum, column, message })
    const before = errors.length

    const id = cellId(cells["ID"])
    if (id === undefined) fail("ID", "Not a valid category ID — leave blank to create.")
    if (id) {
      if (seenIds.has(id)) fail("ID", "This ID appears more than once in the sheet.")
      else if (!existingById.has(id)) {
        fail("ID", "No category has this ID — the sheet may be stale. Re-export and retry.")
      }
      seenIds.add(id)
    }
    const existing = id ? existingById.get(id) : undefined

    const name = cellText(cells["Name"])
    if (!name) fail("Name", "Category name is required.")
    else {
      const nameKey = name.toLowerCase()
      const ownerId = categoryIdByName.get(nameKey)
      if (seenNames.has(nameKey)) fail("Name", "This name appears more than once in the sheet.")
      else if (ownerId && ownerId !== (id ?? "")) {
        fail("Name", "Another category already uses this name — edit that row via its ID.")
      }
      seenNames.add(nameKey)
    }

    const imageUrl = cellText(cells["Image URL"])
    if (imageUrl && (!IMAGE_URL_RE.test(imageUrl) || imageUrl.length > MAX_IMAGE_URL_LEN)) {
      fail("Image URL", "Must be blank or a full http(s) URL under 500 characters.")
    }

    if (errors.length > before) continue

    const payload = {
      name,
      description: cellText(cells["Description"]),
      image_url: imageUrl,
    }

    if (existing) {
      if (
        payload.name === existing.name &&
        payload.description === blankAsEmpty(existing.description) &&
        payload.image_url === blankAsEmpty(existing.imageUrl)
      ) {
        unchanged += 1
        continue
      }
      updates += 1
    } else {
      creates += 1
    }

    planned.push({ rowNum, id: id ?? null, payload })
  }

  return {
    rows: planned,
    preview: { creates, updates, unchanged, totalRows: rows.length, errors },
  }
}

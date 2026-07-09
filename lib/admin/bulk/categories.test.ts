import { test, expect } from "bun:test"
import type { AdminCategoryRow } from "@/lib/admin/category"
import { CATEGORY_COLUMNS, planCategoriesImport, serializeCategoryRow } from "./categories"
import type { RawRow } from "./types"

const CATEGORY: AdminCategoryRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bridal Sets",
  slug: "bridal-sets",
  description: "Full bridal jewellery sets",
  heroBg: null,
  imageUrl: null,
  sortOrder: 1,
  productCount: 4,
}

const CTX = { existing: [CATEGORY] }

function rawRow(overrides: Record<string, unknown> = {}, rowNum = 2): RawRow {
  const values = serializeCategoryRow(CATEGORY)
  const cells = Object.fromEntries(CATEGORY_COLUMNS.map((c, i) => [c.header, values[i]]))
  return { rowNum, cells: { ...cells, ...overrides } }
}

test("untouched export row round-trips as unchanged", () => {
  const plan = planCategoriesImport([rawRow()], CTX)
  expect(plan.preview).toMatchObject({ creates: 0, updates: 0, unchanged: 1, errors: [] })
})

test("image URL matrix: valid https accepted, junk rejected, blank clears", () => {
  const ok = planCategoriesImport([rawRow({ "Image URL": "https://cdn.example.com/a.jpg" })], CTX)
  expect(ok.preview.errors).toEqual([])
  expect(ok.rows[0]?.payload).toMatchObject({ image_url: "https://cdn.example.com/a.jpg" })

  const junk = planCategoriesImport([rawRow({ "Image URL": "not-a-url" })], CTX)
  expect(junk.preview.errors[0]?.column).toBe("Image URL")

  const tooLong = planCategoriesImport(
    [rawRow({ "Image URL": `https://x.example/${"a".repeat(500)}` })],
    CTX,
  )
  expect(tooLong.preview.errors[0]?.column).toBe("Image URL")

  // Fixture imageUrl is already null, so blank alone is unchanged; pair it
  // with a description edit to prove blank exports as "" and clears.
  const cleared = planCategoriesImport([rawRow({ Description: "Updated copy" })], CTX)
  expect(cleared.rows[0]?.payload).toMatchObject({ image_url: "", description: "Updated copy" })
})

test("blank-ID row reusing an existing name is an error, fresh name creates", () => {
  const dup = planCategoriesImport([rawRow({ ID: "", Name: "bridal sets" })], CTX)
  expect(dup.preview.errors[0]?.column).toBe("Name")

  const fresh = planCategoriesImport([rawRow({ ID: "", Name: "Earrings" })], CTX)
  expect(fresh.preview.creates).toBe(1)
  expect(fresh.rows[0]?.id).toBeNull()
})

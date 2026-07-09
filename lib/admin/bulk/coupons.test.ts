import { test, expect } from "bun:test"
import type { AdminCouponRow } from "@/lib/admin/coupon"
import { COUPON_COLUMNS, planCouponsImport, serializeCouponRow } from "./coupons"
import type { RawRow } from "./types"

const PERCENT: AdminCouponRow = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "BRIDE20",
  kind: "percent",
  value: 20,
  minSubtotalPaise: 99900,
  maxDiscountPaise: 200000,
  usageLimit: 500,
  usageCount: 88,
  expiresAt: "2026-10-31T18:29:59.000Z",
  isActive: true,
}

const FIXED: AdminCouponRow = {
  id: "22222222-2222-4222-8222-222222222222",
  code: "FLAT200",
  kind: "fixed",
  value: 20000, // paise
  minSubtotalPaise: null,
  maxDiscountPaise: null,
  usageLimit: null,
  usageCount: 3,
  expiresAt: null,
  isActive: false,
}

const CTX = { existing: [PERCENT, FIXED] }

function rawRow(base: AdminCouponRow, overrides: Record<string, unknown> = {}, rowNum = 2): RawRow {
  const values = serializeCouponRow(base)
  const cells = Object.fromEntries(COUPON_COLUMNS.map((c, i) => [c.header, values[i]]))
  return { rowNum, cells: { ...cells, ...overrides } }
}

test("percent and fixed rows round-trip as unchanged (incl. expiry + Used)", () => {
  const plan = planCouponsImport([rawRow(PERCENT), rawRow(FIXED, {}, 3)], CTX)
  expect(plan.preview).toMatchObject({ creates: 0, updates: 0, unchanged: 2, errors: [] })
})

test("value units: percent stays a percent, fixed converts rupees → paise", () => {
  const pct = planCouponsImport([rawRow(PERCENT, { Value: 25 })], CTX)
  expect(pct.rows[0]?.payload).toMatchObject({ value: 25 })

  const fixed = planCouponsImport([rawRow(FIXED, { Value: 250 })], CTX)
  expect(fixed.rows[0]?.payload).toMatchObject({ value: 25000 })
})

test("percent over 100 and max-discount on non-percent kinds are errors", () => {
  const over = planCouponsImport([rawRow(PERCENT, { Value: 101 })], CTX)
  expect(over.preview.errors[0]?.column).toBe("Value")

  const cap = planCouponsImport([rawRow(FIXED, { "Max discount (₹)": 100 })], CTX)
  expect(cap.preview.errors[0]?.column).toBe("Max discount (₹)")
})

test("expiry parses from date cells and YYYY-MM-DD text; blank means none", () => {
  const fromDate = planCouponsImport(
    [rawRow(PERCENT, { Expires: new Date("2027-01-15T00:00:00.000Z") })],
    CTX,
  )
  expect(fromDate.rows[0]?.payload).toMatchObject({ expires_at: "2027-01-15T18:29:59.000Z" })

  const fromText = planCouponsImport([rawRow(PERCENT, { Expires: "2027-02-01" })], CTX)
  expect(fromText.rows[0]?.payload).toMatchObject({ expires_at: "2027-02-01T18:29:59.000Z" })

  const cleared = planCouponsImport([rawRow(PERCENT, { Expires: "" })], CTX)
  expect(cleared.rows[0]?.payload).toMatchObject({ expires_at: null })

  const junk = planCouponsImport([rawRow(PERCENT, { Expires: "31/10/2026" })], CTX)
  expect(junk.preview.errors[0]?.column).toBe("Expires")
})

test("Used column is export-only: payload never contains usage_count", () => {
  const plan = planCouponsImport([rawRow(PERCENT, { Used: 9999, Value: 25 })], CTX)
  expect(plan.rows[0]?.payload).not.toHaveProperty("usage_count")
})

test("codes upper-case on parse; blank-ID reuse of an existing code errors", () => {
  const dup = planCouponsImport([rawRow(PERCENT, { ID: "", Code: "bride20" })], CTX)
  expect(dup.preview.errors[0]?.column).toBe("Code")

  const fresh = planCouponsImport([rawRow(PERCENT, { ID: "", Code: "newyear10" })], CTX)
  expect(fresh.rows[0]?.payload).toMatchObject({ code: "NEWYEAR10" })
})

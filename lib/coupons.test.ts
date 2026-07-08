import { expect, test } from "bun:test"
import {
  type Coupon,
  couponLabel,
  evaluateCoupon,
  mapCouponRow,
  normalizeCouponCode,
  validateCoupon,
} from "./coupons"

/** The registry the storefront would load from the `coupon` table. */
const REGISTRY: Coupon[] = [
  { code: "BRIDE20", kind: "percent", value: 20 },
  { code: "FREESHIP", kind: "free_shipping", value: 0 },
]

test("normalizeCouponCode trims and upper-cases", () => {
  expect(normalizeCouponCode("  bride20 ")).toBe("BRIDE20")
})

test("validateCoupon applies BRIDE20 as 20% off", () => {
  const result = validateCoupon("BRIDE20", 100000, REGISTRY)
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.discountPaise).toBe(20000)
    expect(result.freeShipping).toBe(false)
    expect(result.coupon.code).toBe("BRIDE20")
  }
})

test("validateCoupon accepts messy casing/whitespace", () => {
  const result = validateCoupon(" bride20 ", 50000, REGISTRY)
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.discountPaise).toBe(10000)
})

test("validateCoupon rejects an empty code", () => {
  expect(validateCoupon("   ", 100000, REGISTRY)).toMatchObject({
    ok: false,
    reason: "empty",
  })
})

test("validateCoupon rejects an unknown code", () => {
  expect(validateCoupon("NOPE", 100000, REGISTRY)).toMatchObject({
    ok: false,
    reason: "unknown",
  })
})

test("validateCoupon rejects any code against an empty registry", () => {
  expect(validateCoupon("BRIDE20", 100000, [])).toMatchObject({
    ok: false,
    reason: "unknown",
  })
})

test("free_shipping coupon flags freeShipping with zero discount", () => {
  const result = validateCoupon("FREESHIP", 80000, REGISTRY)
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.discountPaise).toBe(0)
    expect(result.freeShipping).toBe(true)
  }
})

const PERCENT_WITH_MIN: Coupon = {
  code: "TEST",
  kind: "percent",
  value: 10,
  minSubtotalPaise: 200000,
  maxDiscountPaise: 15000,
}

test("evaluateCoupon guards the minimum subtotal", () => {
  expect(evaluateCoupon(PERCENT_WITH_MIN, 100000)).toMatchObject({
    ok: false,
    reason: "below_min",
  })
})

test("evaluateCoupon caps the discount at maxDiscountPaise", () => {
  const result = evaluateCoupon(PERCENT_WITH_MIN, 500000) // 10% = 50000, capped 15000
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.discountPaise).toBe(15000)
})

test("evaluateCoupon rejects an expired coupon", () => {
  const expired: Coupon = {
    code: "OLD",
    kind: "fixed",
    value: 5000,
    expiresAt: "2020-01-01T00:00:00.000Z",
  }
  expect(evaluateCoupon(expired, 100000, new Date("2026-07-02"))).toMatchObject({
    ok: false,
    reason: "expired",
  })
})

test("evaluateCoupon never discounts more than the subtotal", () => {
  const bigFixed: Coupon = { code: "BIG", kind: "fixed", value: 999900 }
  const result = evaluateCoupon(bigFixed, 50000)
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.discountPaise).toBe(50000)
})

test("couponLabel derives a label from kind/value when none is stored", () => {
  expect(couponLabel({ code: "A", kind: "percent", value: 20 })).toBe("20% off")
  expect(couponLabel({ code: "B", kind: "fixed", value: 20000 })).toBe("₹200 off")
  expect(couponLabel({ code: "C", kind: "free_shipping", value: 0 })).toBe("Free shipping")
})

test("mapCouponRow maps snake_case DB columns to the Coupon shape", () => {
  const coupon = mapCouponRow({
    code: "flat200",
    kind: "fixed",
    value: 20000,
    min_subtotal_paise: 99900,
    max_discount_paise: null,
    expires_at: "2026-08-15T00:00:00.000Z",
  })
  expect(coupon).toMatchObject({
    code: "flat200",
    kind: "fixed",
    value: 20000,
    minSubtotalPaise: 99900,
    maxDiscountPaise: null,
    expiresAt: "2026-08-15T00:00:00.000Z",
  })
})

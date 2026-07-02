import { expect, test } from "bun:test";
import {
  type Coupon,
  evaluateCoupon,
  normalizeCouponCode,
  validateCoupon,
} from "./coupons";

test("normalizeCouponCode trims and upper-cases", () => {
  expect(normalizeCouponCode("  bride20 ")).toBe("BRIDE20");
});

test("validateCoupon applies BRIDE20 as 20% off", () => {
  const result = validateCoupon("BRIDE20", 100000);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.discountPaise).toBe(20000);
    expect(result.coupon.code).toBe("BRIDE20");
  }
});

test("validateCoupon accepts messy casing/whitespace", () => {
  const result = validateCoupon(" bride20 ", 50000);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.discountPaise).toBe(10000);
});

test("validateCoupon rejects an empty code", () => {
  const result = validateCoupon("   ", 100000);
  expect(result).toMatchObject({ ok: false, reason: "empty" });
});

test("validateCoupon rejects an unknown code", () => {
  const result = validateCoupon("NOPE", 100000);
  expect(result).toMatchObject({ ok: false, reason: "unknown" });
});

const PERCENT_WITH_MIN: Coupon = {
  code: "TEST",
  kind: "percent",
  value: 10,
  label: "10% off",
  minSubtotalPaise: 200000,
  maxDiscountPaise: 15000,
};

test("evaluateCoupon guards the minimum subtotal", () => {
  expect(evaluateCoupon(PERCENT_WITH_MIN, 100000)).toMatchObject({
    ok: false,
    reason: "below_min",
  });
});

test("evaluateCoupon caps the discount at maxDiscountPaise", () => {
  const result = evaluateCoupon(PERCENT_WITH_MIN, 500000); // 10% = 50000, capped 15000
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.discountPaise).toBe(15000);
});

test("evaluateCoupon rejects an expired coupon", () => {
  const expired: Coupon = {
    code: "OLD",
    kind: "fixed",
    value: 5000,
    label: "₹50 off",
    expiresAt: "2020-01-01T00:00:00.000Z",
  };
  expect(evaluateCoupon(expired, 100000, new Date("2026-07-02"))).toMatchObject({
    ok: false,
    reason: "expired",
  });
});

test("evaluateCoupon never discounts more than the subtotal", () => {
  const bigFixed: Coupon = {
    code: "BIG",
    kind: "fixed",
    value: 999900,
    label: "big",
  };
  const result = evaluateCoupon(bigFixed, 50000);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.discountPaise).toBe(50000);
});

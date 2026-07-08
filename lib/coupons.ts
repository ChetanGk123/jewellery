/**
 * Pure coupon logic — validation and discount maths. No React or storage deps,
 * so it's unit testable and runs on the client (cart preview) and the server.
 * Client discounts are display-only; place_order recomputes authoritatively and
 * never trusts them.
 *
 * As of TASKS 3.6 the coupon registry is DB-backed (the `coupon` table). The
 * storefront loads the currently-valid coupons server-side and passes them in;
 * there is no hard-coded rule here anymore (that drift risk is gone).
 */

import { formatPaise } from "@/lib/utils/money"

export type CouponKind = "percent" | "fixed" | "free_shipping"

export type Coupon = {
  code: string
  kind: CouponKind
  /** Percent 0–100 for `percent`, a paise amount for `fixed`, ignored for `free_shipping`. */
  value: number
  /** Optional pre-computed human label; falls back to a derived one. */
  label?: string
  /** Minimum cart subtotal (paise) required to use the code. */
  minSubtotalPaise?: number | null
  /** Cap on the discount (paise), for percent/fixed coupons. */
  maxDiscountPaise?: number | null
  /** ISO instant; the coupon is invalid strictly after this. Null/omit for no expiry. */
  expiresAt?: string | null
}

/** A `coupon` table row (public columns) as returned by Supabase. */
export type CouponRow = {
  code: string
  kind: CouponKind
  value: number
  min_subtotal_paise: number | null
  max_discount_paise: number | null
  expires_at: string | null
}

/** Map a DB row to the pure `Coupon` shape used by the validators. */
export function mapCouponRow(row: CouponRow): Coupon {
  return {
    code: row.code,
    kind: row.kind,
    value: row.value,
    minSubtotalPaise: row.min_subtotal_paise,
    maxDiscountPaise: row.max_discount_paise,
    expiresAt: row.expires_at,
  }
}

/** Human label for a coupon, e.g. "20% off" / "₹200 off" / "Free shipping". */
export function couponLabel(coupon: Coupon): string {
  if (coupon.label) return coupon.label
  if (coupon.kind === "percent") return `${coupon.value}% off`
  if (coupon.kind === "free_shipping") return "Free shipping"
  return `${formatPaise(coupon.value)} off`
}

/** Canonical form used for lookups and storage (trimmed, upper-cased). */
export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export type CouponFailure = "empty" | "unknown" | "expired" | "below_min"

export type CouponResult =
  | { ok: true; coupon: Coupon; discountPaise: number; freeShipping: boolean }
  | { ok: false; reason: CouponFailure; message: string }

/** Discount for a known coupon against a subtotal — clamped to [0, subtotal]. */
function couponDiscountPaise(coupon: Coupon, subtotalPaise: number): number {
  if (coupon.kind === "free_shipping") return 0
  const raw =
    coupon.kind === "percent" ? Math.round((subtotalPaise * coupon.value) / 100) : coupon.value
  const capped = coupon.maxDiscountPaise != null ? Math.min(raw, coupon.maxDiscountPaise) : raw
  return Math.max(0, Math.min(capped, subtotalPaise))
}

/** Check a resolved coupon against the cart's subtotal and the current time. */
export function evaluateCoupon(
  coupon: Coupon,
  subtotalPaise: number,
  now: Date = new Date(),
): CouponResult {
  if (coupon.expiresAt && now.getTime() > new Date(coupon.expiresAt).getTime()) {
    return { ok: false, reason: "expired", message: "This coupon has expired." }
  }
  if (coupon.minSubtotalPaise != null && subtotalPaise < coupon.minSubtotalPaise) {
    return {
      ok: false,
      reason: "below_min",
      message: `Spend ${formatPaise(coupon.minSubtotalPaise)} to use this code.`,
    }
  }
  return {
    ok: true,
    coupon,
    discountPaise: couponDiscountPaise(coupon, subtotalPaise),
    freeShipping: coupon.kind === "free_shipping",
  }
}

/**
 * Look up and validate a raw code against the supplied registry (the active
 * coupons loaded from the DB). Kept pure — the caller provides the coupons.
 */
export function validateCoupon(
  rawCode: string,
  subtotalPaise: number,
  coupons: Coupon[],
  now: Date = new Date(),
): CouponResult {
  const code = normalizeCouponCode(rawCode)
  if (!code) {
    return { ok: false, reason: "empty", message: "Enter a coupon code." }
  }
  const coupon = coupons.find((c) => normalizeCouponCode(c.code) === code)
  if (!coupon) {
    return { ok: false, reason: "unknown", message: "That code isn't valid." }
  }
  return evaluateCoupon(coupon, subtotalPaise, now)
}

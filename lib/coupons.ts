/**
 * Pure coupon logic — the registry, validation, and discount maths. No React or
 * storage deps, so it's unit testable and can run on the client (for the cart
 * preview) and the server (authoritative check at order creation, 2.5). Client
 * discounts are display-only; the server recomputes and never trusts them.
 *
 * v1 ships a single hardcoded coupon (BRIDE20, advertised in the announcement
 * banner). There's no coupon table yet — promote this to DB-backed only when the
 * store actually needs to manage codes (YAGNI).
 */

import { formatPaise } from "@/lib/utils/money";

export type Coupon = {
  code: string;
  kind: "percent" | "fixed";
  /** Percent 0–100 for `percent`, or a paise amount for `fixed`. */
  value: number;
  /** Short human label, e.g. "20% off". */
  label: string;
  /** Minimum cart subtotal (paise) required to use the code. */
  minSubtotalPaise?: number;
  /** Cap on the discount (paise), for percent coupons. */
  maxDiscountPaise?: number;
  /** ISO instant; the coupon is invalid strictly after this. Omit for no expiry. */
  expiresAt?: string;
};

const COUPONS: Record<string, Coupon> = {
  BRIDE20: { code: "BRIDE20", kind: "percent", value: 20, label: "20% off" },
};

/** Canonical form used for lookups and storage (trimmed, upper-cased). */
export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export type CouponFailure = "empty" | "unknown" | "expired" | "below_min";

export type CouponResult =
  | { ok: true; coupon: Coupon; discountPaise: number }
  | { ok: false; reason: CouponFailure; message: string };

/** Discount for a known coupon against a subtotal — clamped to [0, subtotal]. */
function couponDiscountPaise(coupon: Coupon, subtotalPaise: number): number {
  const raw =
    coupon.kind === "percent"
      ? Math.round((subtotalPaise * coupon.value) / 100)
      : coupon.value;
  const capped =
    coupon.maxDiscountPaise != null ? Math.min(raw, coupon.maxDiscountPaise) : raw;
  return Math.max(0, Math.min(capped, subtotalPaise));
}

/** Check a resolved coupon against the cart's subtotal and the current time. */
export function evaluateCoupon(
  coupon: Coupon,
  subtotalPaise: number,
  now: Date = new Date(),
): CouponResult {
  if (coupon.expiresAt && now.getTime() > new Date(coupon.expiresAt).getTime()) {
    return { ok: false, reason: "expired", message: "This coupon has expired." };
  }
  if (
    coupon.minSubtotalPaise != null &&
    subtotalPaise < coupon.minSubtotalPaise
  ) {
    return {
      ok: false,
      reason: "below_min",
      message: `Spend ${formatPaise(coupon.minSubtotalPaise)} to use this code.`,
    };
  }
  return {
    ok: true,
    coupon,
    discountPaise: couponDiscountPaise(coupon, subtotalPaise),
  };
}

/** Look up and validate a raw code entered by the customer. */
export function validateCoupon(
  rawCode: string,
  subtotalPaise: number,
  now: Date = new Date(),
): CouponResult {
  const code = normalizeCouponCode(rawCode);
  if (!code) {
    return { ok: false, reason: "empty", message: "Enter a coupon code." };
  }
  const coupon = COUPONS[code];
  if (!coupon) {
    return { ok: false, reason: "unknown", message: "That code isn't valid." };
  }
  return evaluateCoupon(coupon, subtotalPaise, now);
}

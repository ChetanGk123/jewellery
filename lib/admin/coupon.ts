/**
 * Client-safe coupon types + list-cell helpers for the admin console (TASKS
 * 3.6). Kept free of `server-only` imports so the client CouponsView/Modal and
 * the server data module (`lib/db/admin-coupons.ts`) can share them without
 * dragging the Supabase server client into the browser bundle. Mirrors the
 * split used by `lib/admin/category.ts` / `lib/admin/product-status.ts`.
 */

import { type CouponKind, couponLabel } from "@/lib/coupons"
import { formatPaise } from "@/lib/utils/money"

export type { CouponKind }

/** Coupons shown per page in the admin table (TASKS 5.10). */
export const ADMIN_COUPONS_PAGE_SIZE = 10

/** A `coupon` row as the admin console needs it (all columns, active or not). */
export type AdminCouponRow = {
  id: string
  code: string
  kind: CouponKind
  value: number
  minSubtotalPaise: number | null
  maxDiscountPaise: number | null
  usageLimit: number | null
  usageCount: number
  /** ISO instant or null (no expiry). */
  expiresAt: string | null
  isActive: boolean
}

/** "20% off" / "₹200 off" / "Free shipping" — reuses the storefront label. */
export function couponDiscountLabel(row: AdminCouponRow): string {
  return couponLabel({ code: row.code, kind: row.kind, value: row.value })
}

/** "₹999" for a minimum, or an em-dash when there's none. */
export function couponMinOrderLabel(row: AdminCouponRow): string {
  return row.minSubtotalPaise != null ? formatPaise(row.minSubtotalPaise) : "—"
}

/** "88 / 500" when capped, otherwise "142 used". */
export function couponUsageLabel(row: AdminCouponRow): string {
  return row.usageLimit != null ? `${row.usageCount} / ${row.usageLimit}` : `${row.usageCount} used`
}

const EXPIRY_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

/** "31 Oct 2026" or "No expiry". Formatted in UTC to match how it's stored. */
export function couponExpiryLabel(row: AdminCouponRow): string {
  if (!row.expiresAt) return "No expiry"
  const parsed = new Date(row.expiresAt)
  if (Number.isNaN(parsed.getTime())) return "No expiry"
  return EXPIRY_FMT.format(parsed)
}

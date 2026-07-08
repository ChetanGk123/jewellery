import "server-only"
import { type Coupon, type CouponKind, mapCouponRow } from "@/lib/coupons"
import { createServerClient } from "./server"

/**
 * Storefront coupon registry (TASKS 3.6). Reads the currently-usable coupons
 * from the `coupon` table so the cart/checkout preview is table-driven. This is
 * display-only — `place_order` re-validates and computes the discount
 * authoritatively at order creation. Degrades to an empty list on error so the
 * cart still renders (a stored code simply shows "not valid").
 *
 * Filters `is_active` + the usage cap explicitly rather than trusting RLS: the
 * public read policy already scopes anon users to usable coupons, but an admin
 * browsing the storefront also satisfies the *admin* read policy (every row,
 * inactive included). Without this filter the cart would "apply" a disabled or
 * exhausted code that `place_order` then drops — the mismatch this closes.
 * Expiry and min-subtotal are left to `evaluateCoupon` (the client validator
 * already enforces both identically), so only the checks the client can't see
 * are pushed down here.
 */
export async function getActiveCoupons(): Promise<Coupon[]> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from("coupon")
      .select(
        "code, kind, value, min_subtotal_paise, max_discount_paise, expires_at, usage_limit, usage_count",
      )
      .eq("is_active", true)
    return (data ?? [])
      .filter((row) => row.usage_limit == null || row.usage_count < row.usage_limit)
      .map((row) =>
        mapCouponRow({
          code: row.code,
          kind: row.kind as CouponKind,
          value: row.value,
          min_subtotal_paise: row.min_subtotal_paise,
          max_discount_paise: row.max_discount_paise,
          expires_at: row.expires_at,
        }),
      )
  } catch {
    return []
  }
}

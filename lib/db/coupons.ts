import "server-only";
import { type Coupon, type CouponKind, mapCouponRow } from "@/lib/coupons";
import { createServerClient } from "./server";

/**
 * Storefront coupon registry (TASKS 3.6). Reads the currently-usable coupons
 * from the `coupon` table via the public RLS policy (active, unexpired, under
 * their usage cap) so the cart/checkout preview is table-driven. This is
 * display-only — `place_order` re-validates and computes the discount
 * authoritatively at order creation. Degrades to an empty list on error so the
 * cart still renders (a stored code simply shows "not valid").
 */
export async function getActiveCoupons(): Promise<Coupon[]> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("coupon")
      .select(
        "code, kind, value, min_subtotal_paise, max_discount_paise, expires_at",
      );
    return (data ?? []).map((row) =>
      mapCouponRow({ ...row, kind: row.kind as CouponKind }),
    );
  } catch {
    return [];
  }
}

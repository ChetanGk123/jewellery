import "server-only";
import type { AdminCouponRow } from "@/lib/admin/coupon";
import type { CouponKind } from "@/lib/coupons";
import { createServerClient } from "./server";

/**
 * Admin coupons (TASKS 3.6). Reads every `coupon` row (active or not) through
 * the admin's cookie session (0012 `coupon_admin_read` RLS policy), oldest
 * first so the seeded BRIDE20 stays at the top like the prototype. Writes go
 * through the `admin_upsert_coupon` / `admin_toggle_coupon` RPCs, never a direct
 * table write. Degrades to an empty list on error so the console still renders.
 */
export async function listAdminCoupons(): Promise<AdminCouponRow[]> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("coupon")
      .select(
        "id, code, kind, value, min_subtotal_paise, max_discount_paise, usage_limit, usage_count, expires_at, is_active",
      )
      .order("created_at", { ascending: true });

    return (data ?? []).map((c) => ({
      id: c.id,
      code: c.code,
      kind: c.kind as CouponKind,
      value: c.value,
      minSubtotalPaise: c.min_subtotal_paise,
      maxDiscountPaise: c.max_discount_paise,
      usageLimit: c.usage_limit,
      usageCount: c.usage_count,
      expiresAt: c.expires_at,
      isActive: c.is_active,
    }));
  } catch {
    return [];
  }
}

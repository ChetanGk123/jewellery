import "server-only"
import { ADMIN_COUPONS_PAGE_SIZE, type AdminCouponRow } from "@/lib/admin/coupon"
import type { CouponKind } from "@/lib/coupons"
import { type AdminRead, loadAdmin } from "./admin-read"
import { createServerClient } from "./server"

export type AdminCouponsPage = {
  rows: AdminCouponRow[]
  page: number
  pageCount: number
  total: number
}

function emptyPage(page: number): AdminCouponsPage {
  return { rows: [], page, pageCount: 1, total: 0 }
}

/**
 * Admin coupons (TASKS 3.6, paginated in 5.10). Reads one page of `coupon` rows
 * (active or not) through the admin's cookie session (0012 `coupon_admin_read`
 * RLS policy), oldest first so the seeded BRIDE20 stays at the top like the
 * prototype. The total comes from an exact count so the pager is honest. Writes
 * go through the `admin_upsert_coupon` / `admin_toggle_coupon` /
 * `admin_delete_coupon` RPCs, never a direct table write.
 */
export async function listAdminCoupons(opts: {
  page: number
}): Promise<AdminRead<AdminCouponsPage>> {
  const page = Math.max(1, opts.page)

  return loadAdmin(
    "coupons",
    async () => {
      const supabase = await createServerClient()
      const from = (page - 1) * ADMIN_COUPONS_PAGE_SIZE

      const { data, count } = await supabase
        .from("coupon")
        .select(
          "id, code, kind, value, min_subtotal_paise, max_discount_paise, usage_limit, usage_count, expires_at, is_active",
          { count: "exact" },
        )
        .order("created_at", { ascending: true })
        .range(from, from + ADMIN_COUPONS_PAGE_SIZE - 1)

      const rows: AdminCouponRow[] = (data ?? []).map((c) => ({
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
      }))

      const total = count ?? 0
      const pageCount = Math.max(1, Math.ceil(total / ADMIN_COUPONS_PAGE_SIZE))

      return { rows, page, pageCount, total }
    },
    emptyPage(page),
  )
}

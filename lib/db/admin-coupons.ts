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
  search: string
}

function emptyPage(page: number, search: string): AdminCouponsPage {
  return { rows: [], page, pageCount: 1, total: 0, search }
}

/** Cap on rows in the bulk .xlsx export. */
const EXPORT_COUPONS_CAP = 5000

/**
 * Every coupon for the bulk .xlsx export and the import's diff context
 * (admin gate is the caller's job), oldest first like the list.
 */
export async function getAllCouponsForExport(): Promise<AdminCouponRow[]> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from("coupon")
      .select(
        "id, code, kind, value, min_subtotal_paise, max_discount_paise, usage_limit, usage_count, expires_at, is_active",
      )
      .order("created_at", { ascending: true })
      .limit(EXPORT_COUPONS_CAP)
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
    }))
  } catch (err) {
    console.error("[admin-read] coupons export failed:", err)
    return []
  }
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
  search?: string
}): Promise<AdminRead<AdminCouponsPage>> {
  const page = Math.max(1, opts.page)
  // Codes are plain alphanumerics; strip ilike wildcards / filter grammar (6.2).
  const search = (opts.search ?? "").replace(/[%,()]/g, " ").trim()

  return loadAdmin(
    "coupons",
    async () => {
      const supabase = await createServerClient()
      const from = (page - 1) * ADMIN_COUPONS_PAGE_SIZE

      let query = supabase
        .from("coupon")
        .select(
          "id, code, kind, value, min_subtotal_paise, max_discount_paise, usage_limit, usage_count, expires_at, is_active",
          { count: "exact" },
        )
        .order("created_at", { ascending: true })
        .range(from, from + ADMIN_COUPONS_PAGE_SIZE - 1)
      if (search) query = query.ilike("code", `%${search}%`)
      const { data, count } = await query

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

      return { rows, page, pageCount, total, search }
    },
    emptyPage(page, search),
  )
}

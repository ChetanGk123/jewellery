import "server-only"
import {
  ADMIN_REVIEWS_PAGE_SIZE,
  type AdminReviewRow,
  type ReviewCounts,
  type ReviewFilter,
  type ReviewStatus,
} from "@/lib/admin/review"
import { type AdminRead, loadAdmin } from "./admin-read"
import { createServerClient } from "./server"

export type AdminReviewsPage = {
  rows: AdminReviewRow[]
  counts: ReviewCounts
  filter: ReviewFilter
  page: number
  pageCount: number
  total: number
}

function emptyPage(filter: ReviewFilter, page: number): AdminReviewsPage {
  return {
    rows: [],
    counts: { Pending: 0, Approved: 0, All: 0 },
    filter,
    page,
    pageCount: 1,
    total: 0,
  }
}

/** The `review.status` a filter tab maps to, or null for "All" (every status). */
function statusFor(filter: ReviewFilter): ReviewStatus | null {
  if (filter === "Pending") return "pending"
  if (filter === "Approved") return "approved"
  return null
}

/**
 * Admin reviews (TASKS 3.7, paginated in 5.10). Reads one page of `review` rows
 * (any status) through the admin's cookie session (0006 `review_admin_read` RLS
 * policy), newest first, and resolves each page row's product name from a
 * bounded `product` read (only the ids on the page — mirrors how
 * `admin-categories.ts` tallies in JS rather than an embedded join). The
 * moderation-tab counts come from exact head-counts (scale-safe vs. tallying the
 * whole table). Writes go through the `admin_set_review_status` RPC (0014).
 */
export async function listAdminReviews(opts: {
  filter: ReviewFilter
  page: number
}): Promise<AdminRead<AdminReviewsPage>> {
  const filter = opts.filter
  const page = Math.max(1, opts.page)
  const status = statusFor(filter)

  return loadAdmin(
    "reviews",
    async () => {
      const supabase = await createServerClient()
      const from = (page - 1) * ADMIN_REVIEWS_PAGE_SIZE

      let rowsQuery = supabase
        .from("review")
        .select("id, product_id, name, rating, title, body, status, created_at")
        .order("created_at", { ascending: false })
        .range(from, from + ADMIN_REVIEWS_PAGE_SIZE - 1)
      if (status) rowsQuery = rowsQuery.eq("status", status)

      const headCount = (s: ReviewStatus) =>
        supabase.from("review").select("*", { count: "exact", head: true }).eq("status", s)
      const allCount = supabase.from("review").select("*", { count: "exact", head: true })

      const [rowsRes, pendingRes, approvedRes, allRes] = await Promise.all([
        rowsQuery,
        headCount("pending"),
        headCount("approved"),
        allCount,
      ])

      const counts: ReviewCounts = {
        Pending: pendingRes.count ?? 0,
        Approved: approvedRes.count ?? 0,
        All: allRes.count ?? 0,
      }

      const reviews = rowsRes.data ?? []
      const productIds = [...new Set(reviews.map((r) => r.product_id))]
      const { data: products } = productIds.length
        ? await supabase.from("product").select("id, name").in("id", productIds)
        : { data: [] }
      const nameById = new Map((products ?? []).map((p) => [p.id, p.name]))

      const rows: AdminReviewRow[] = reviews.map((r) => ({
        id: r.id,
        productName: nameById.get(r.product_id) ?? "Unknown product",
        author: r.name,
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: r.status as ReviewStatus,
        createdAt: r.created_at,
      }))

      const total = counts[filter]
      const pageCount = Math.max(1, Math.ceil(total / ADMIN_REVIEWS_PAGE_SIZE))

      return { rows, counts, filter, page, pageCount, total }
    },
    emptyPage(filter, page),
  )
}

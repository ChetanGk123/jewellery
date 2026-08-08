import "server-only"
import {
  CUSTOMERS_PAGE_SIZE,
  istDate,
  resolveReviews,
  type CustomerOrder,
  type CustomerOrderRow,
  type CustomerReviewRow,
  type CustomerSort,
} from "@/lib/admin/customers"
import { loadAdmin, type AdminRead } from "./admin-read"
import { createServerClient } from "./server"

/**
 * Admin Customers console (Phase 11). Identity is `order.user_id`: `place_order`
 * raises AUTH_REQUIRED, so every real checkout carries one, and `review.user_id`
 * keys off the same auth.users id. Seed orders with a NULL user_id have no
 * identity to group under and are excluded by the RPC.
 *
 * The list needs SQL (PostgREST cannot GROUP BY) and goes through the
 * `admin_list_customers` RPC. The detail needs no RPC — orders and reviews are
 * both plain `user_id` filters the admin RLS policies already allow — so it is
 * assembled here instead of in a second definer function.
 */

export type AdminCustomerRow = {
  userId: string
  /** Name/phone/email from the customer's most recent order (see the RPC). */
  name: string
  phone: string
  email: string
  orderCount: number
  cancelledCount: number
  /** Lifetime spend in paise, Cancelled orders excluded (COD — never paid). */
  lifetimePaise: number
  firstOrderAt: string
  lastOrderAt: string
  firstOrderLabel: string
  lastOrderLabel: string
  reviewCount: number
  /** Mean rating this customer has given, or null if they've never reviewed. */
  avgRating: number | null
}

export type AdminCustomersPage = {
  rows: AdminCustomerRow[]
  search: string
  sort: CustomerSort
  page: number
  pageCount: number
  total: number
}

export type AdminCustomerDetail = {
  customer: AdminCustomerRow
  orders: CustomerOrder[]
}

function emptyPage(search: string, sort: CustomerSort, page: number): AdminCustomersPage {
  return { rows: [], search, sort, page, pageCount: 1, total: 0 }
}

type RpcRow = {
  user_id: string
  name: string
  phone: string
  email: string
  order_count: number
  cancelled_count: number
  lifetime_paise: number
  first_order_at: string
  last_order_at: string
  review_count: number
  avg_rating: number | null
  total_count: number
}

function mapRpcRow(r: RpcRow): AdminCustomerRow {
  return {
    userId: r.user_id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    // Postgres bigint arrives as a string over PostgREST — coerce every count.
    orderCount: Number(r.order_count),
    cancelledCount: Number(r.cancelled_count),
    lifetimePaise: Number(r.lifetime_paise),
    firstOrderAt: r.first_order_at,
    lastOrderAt: r.last_order_at,
    firstOrderLabel: istDate(r.first_order_at),
    lastOrderLabel: istDate(r.last_order_at),
    reviewCount: Number(r.review_count),
    avgRating: r.avg_rating == null ? null : Number(r.avg_rating),
  }
}

/** One page of the aggregated customer list. */
export async function listAdminCustomers(opts: {
  search?: string
  sort?: CustomerSort
  page?: number
}): Promise<AdminRead<AdminCustomersPage>> {
  const search = (opts.search ?? "").trim()
  const sort: CustomerSort = opts.sort ?? "recent"
  const page = Math.max(1, opts.page ?? 1)

  return loadAdmin(
    "customers",
    async () => {
      const supabase = await createServerClient()
      const { data, error } = await supabase.rpc("admin_list_customers", {
        p_search: search || null,
        p_sort: sort,
        p_limit: CUSTOMERS_PAGE_SIZE,
        p_offset: (page - 1) * CUSTOMERS_PAGE_SIZE,
      })
      // Surface the failure — an empty customer list must never stand in for a
      // broken read (audit C1).
      if (error) throw error

      const rows = (data ?? []) as RpcRow[]
      const total = rows.length > 0 ? Number(rows[0].total_count) : 0
      const pageCount = Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE))
      return { rows: rows.map(mapRpcRow), search, sort, page, pageCount, total }
    },
    emptyPage(search, sort, page),
  )
}

/**
 * One customer's full history: every order newest-first with its line items,
 * each carrying the review that customer left for that product.
 */
export async function getAdminCustomerDetail(
  userId: string,
  header: AdminCustomerRow,
): Promise<AdminRead<AdminCustomerDetail>> {
  return loadAdmin(
    "customer-detail",
    async () => {
      const supabase = await createServerClient()
      const [ordersRes, reviewsRes] = await Promise.all([
        supabase
          .from("order")
          .select("order_no, status, created_at, total_paise, order_item(name, qty, line_total_paise, product_id)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("review")
          .select("product_id, rating, title, body, created_at")
          .eq("user_id", userId),
      ])
      if (ordersRes.error) throw ordersRes.error
      if (reviewsRes.error) throw reviewsRes.error

      return {
        customer: header,
        orders: resolveReviews(
          (ordersRes.data ?? []) as CustomerOrderRow[],
          (reviewsRes.data ?? []) as CustomerReviewRow[],
        ),
      }
    },
    { customer: header, orders: [] },
  )
}

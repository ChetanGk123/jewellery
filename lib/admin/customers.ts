/**
 * Client-safe Customers helpers (Phase 11). Kept out of the server-only
 * `lib/db/admin-customers.ts` so the list view and detail can import these
 * without pulling a server module into the browser bundle — the same split as
 * `product-status.ts` / `order-status.ts`.
 */

/** Per-customer order history, as the order drawer's "N orders" line shows it. */
export type CustomerHistory = { orders: number; cancelled: number }

/**
 * Tally `{user_id -> history}` from narrow `user_id, status` rows.
 *
 * Keyed on `user_id`, not `customer_phone` (11.6): a phone is not an identity.
 * Two accounts already share one number in this store's data, so the old phone
 * tally reported "4 orders from this customer" on orders belonging to buyers
 * with 3 and 1 — and disagreed with the Customers console, which groups by
 * user. Rows with no `user_id` (legacy seed orders) have no identity to tally
 * under and are skipped.
 */
export function tallyHistory(
  rows: { user_id: string | null; status: string }[],
): Map<string, CustomerHistory> {
  const byUser = new Map<string, CustomerHistory>()
  for (const row of rows) {
    if (!row.user_id) continue
    const prev = byUser.get(row.user_id) ?? { orders: 0, cancelled: 0 }
    byUser.set(row.user_id, {
      orders: prev.orders + 1,
      cancelled: prev.cancelled + (row.status === "Cancelled" ? 1 : 0),
    })
  }
  return byUser
}

/** Customers per page in the admin list. */
export const CUSTOMERS_PAGE_SIZE = 10

const IST = "Asia/Kolkata"

/** IST day label, e.g. "08 Aug 2026". */
export function istDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/** The `order` + embedded `order_item` shape `resolveReviews` consumes. */
export type CustomerOrderRow = {
  order_no: string
  status: string
  created_at: string
  total_paise: number
  order_item: { name: string; qty: number; line_total_paise: number; product_id: string | null }[]
}

/** The `review` shape `resolveReviews` consumes. */
export type CustomerReviewRow = {
  product_id: string
  rating: number
  title: string | null
  body: string | null
  created_at: string
}

/** One review, resolved onto the order that plausibly prompted it. */
export type CustomerReview = {
  productId: string
  rating: number
  title: string | null
  body: string | null
  createdAt: string
  dateLabel: string
}

/** One line of a customer's order, with its review when they left one. */
export type CustomerOrderItem = {
  name: string
  productId: string | null
  qty: number
  lineTotalPaise: number
  review: CustomerReview | null
  /**
   * Set when this product was reviewed against an EARLIER order — `review` is
   * null here so one review never renders under two orders.
   */
  reviewedOnOrderNo: string | null
}

export type CustomerOrder = {
  orderNo: string
  status: string
  createdAt: string
  dateLabel: string
  totalPaise: number
  items: CustomerOrderItem[]
}

/**
 * Attach each review to the EARLIEST order containing that product.
 *
 * `review` has no `order_id` — it is keyed on (product, user) — so a customer
 * who bought the same piece twice would otherwise see one review rendered under
 * both orders. That case is already live: one buyer has three products spanning
 * two orders each. Later orders get `reviewedOnOrderNo` instead, which reads
 * honestly and never double-counts.
 *
 * `orders` must be newest-first; it is walked in reverse so the oldest order
 * claims the review.
 */
export function resolveReviews(
  orders: CustomerOrderRow[],
  reviews: CustomerReviewRow[],
): CustomerOrder[] {
  const byProduct = new Map<string, CustomerReviewRow>()
  for (const r of reviews) byProduct.set(r.product_id, r)

  const claimedBy = new Map<string, string>()
  for (const order of [...orders].reverse()) {
    for (const item of order.order_item) {
      if (!item.product_id) continue
      if (byProduct.has(item.product_id) && !claimedBy.has(item.product_id)) {
        claimedBy.set(item.product_id, order.order_no)
      }
    }
  }

  return orders.map((order) => ({
    orderNo: order.order_no,
    status: order.status,
    createdAt: order.created_at,
    dateLabel: istDate(order.created_at),
    totalPaise: order.total_paise,
    items: order.order_item.map((item) => {
      const review = item.product_id ? byProduct.get(item.product_id) : undefined
      const owner = item.product_id ? claimedBy.get(item.product_id) : undefined
      const isOwner = review != null && owner === order.order_no
      return {
        name: item.name,
        productId: item.product_id,
        qty: item.qty,
        lineTotalPaise: item.line_total_paise,
        review: isOwner
          ? {
              productId: review.product_id,
              rating: review.rating,
              title: review.title,
              body: review.body,
              createdAt: review.created_at,
              dateLabel: istDate(review.created_at),
            }
          : null,
        reviewedOnOrderNo: review != null && !isOwner ? (owner ?? null) : null,
      }
    }),
  }))
}

export const CUSTOMER_SORTS = ["recent", "spend", "orders", "name"] as const
export type CustomerSort = (typeof CUSTOMER_SORTS)[number]

/** Dropdown labels for each sort. */
export const CUSTOMER_SORT_LABELS: Record<CustomerSort, string> = {
  recent: "Most recent order",
  spend: "Highest spend",
  orders: "Most orders",
  name: "Name (A–Z)",
}

/** Coerce an untrusted `?sort=` value to a valid sort. */
export function toCustomerSort(value: string | undefined): CustomerSort {
  return value && (CUSTOMER_SORTS as readonly string[]).includes(value)
    ? (value as CustomerSort)
    : "recent"
}

/** A customer counts as returning from their third order (audit-friendly). */
const REPEAT_ORDER_THRESHOLD = 3

export type CustomerChip = { label: string; color: string; bg: string }

/**
 * The standing chip for a customer row. Cancellations outrank loyalty: on a COD
 * store an operator needs the delivery-risk signal before the spend signal.
 */
export function customerChip(orderCount: number, cancelledCount: number): CustomerChip | null {
  if (cancelledCount > 0) return { label: "Has cancelled", color: "#B7791F", bg: "#FBF1DD" }
  if (orderCount >= REPEAT_ORDER_THRESHOLD) {
    return { label: "Repeat", color: "#1B7A3D", bg: "#E7F3EB" }
  }
  return null
}

/**
 * Share of this customer's orders that were cancelled, 0–100, rounded. Returns
 * 0 rather than NaN for a customer with no orders (unreachable via the RPC,
 * which only groups buyers, but the maths shouldn't depend on that).
 */
export function cancellationRate(orderCount: number, cancelledCount: number): number {
  if (orderCount <= 0) return 0
  return Math.round((cancelledCount / orderCount) * 100)
}

/**
 * Average order value in paise across NON-cancelled orders — `lifetimePaise`
 * already excludes cancelled ones, so the divisor must too or the average is
 * understated for anyone who has cancelled.
 */
export function averageOrderPaise(lifetimePaise: number, orderCount: number, cancelledCount: number): number {
  const paidOrders = orderCount - cancelledCount
  if (paidOrders <= 0) return 0
  return Math.round(lifetimePaise / paidOrders)
}

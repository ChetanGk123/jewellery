import "server-only"
import { createServerClient } from "./server"

/** Sidebar badge counts — work awaiting the operator. */
export type AdminNavCounts = {
  /** Orders in `Pending` status (not yet processed). */
  orders: number
  /** Return requests in `Requested` status (awaiting a decision, 8.7). */
  returns: number
  /** Reviews awaiting moderation. */
  reviews: number
  /** Contact tickets in `New` status (not yet started). */
  messages: number
}

const ZERO_COUNTS: AdminNavCounts = { orders: 0, returns: 0, reviews: 0, messages: 0 }

/**
 * Live counts for the sidebar badges. Reads through the admin's own cookie
 * session — the `is_admin()` RLS policies (0006) let an admin see every `order`
 * and `review`, so no service-role key is needed.
 *
 * Resilient by design: if a query fails (or the caller somehow isn't an admin),
 * the badges fall back to 0 rather than crashing the admin chrome.
 */
export async function getAdminNavCounts(): Promise<AdminNavCounts> {
  try {
    const supabase = await createServerClient()
    const [orders, returns, reviews, messages] = await Promise.all([
      supabase.from("order").select("*", { count: "exact", head: true }).eq("status", "Pending"),
      supabase
        .from("return_request")
        .select("*", { count: "exact", head: true })
        .eq("status", "Requested"),
      supabase.from("review").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("contact_message")
        .select("*", { count: "exact", head: true })
        .eq("status", "New"),
    ])

    return {
      orders: orders.count ?? 0,
      returns: returns.count ?? 0,
      reviews: reviews.count ?? 0,
      messages: messages.count ?? 0,
    }
  } catch (err) {
    console.error("[admin-read] nav-counts failed:", err)
    return ZERO_COUNTS
  }
}

import "server-only";
import { createServerClient } from "./server";

/** Sidebar badge counts — work awaiting the operator. */
export type AdminNavCounts = {
  /** Orders in `Pending` status (not yet processed). */
  orders: number;
  /** Reviews awaiting moderation. */
  reviews: number;
  /** Unresolved contact messages (0 until the table lands in 3.8). */
  messages: number;
};

const ZERO_COUNTS: AdminNavCounts = { orders: 0, reviews: 0, messages: 0 };

/**
 * Live counts for the sidebar badges. Reads through the admin's own cookie
 * session — the `is_admin()` RLS policies (0006) let an admin see every `order`
 * and `review`, so no service-role key is needed.
 *
 * Resilient by design: if a query fails (or the caller somehow isn't an admin),
 * the badges fall back to 0 rather than crashing the admin chrome. `messages`
 * stays 0 until the `contact_message` table exists (3.8) — we don't query a
 * table that isn't there.
 */
export async function getAdminNavCounts(): Promise<AdminNavCounts> {
  try {
    const supabase = await createServerClient();
    const [orders, reviews] = await Promise.all([
      supabase
        .from("order")
        .select("*", { count: "exact", head: true })
        .eq("status", "Pending"),
      supabase
        .from("review")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    return {
      orders: orders.count ?? 0,
      reviews: reviews.count ?? 0,
      messages: 0,
    };
  } catch {
    return ZERO_COUNTS;
  }
}

import "server-only";
import { getAdminClient } from "./admin";

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
 * Live counts for the sidebar badges. Reads through the service-role client —
 * the publishable key can't see deny-all `order` rows or unapproved `review`s.
 *
 * Resilient by design: if `SUPABASE_SECRET_KEY` is missing or a query fails, the
 * badges fall back to 0 rather than crashing the admin chrome (the shell must
 * render even before the secret is configured). `messages` stays 0 until the
 * `contact_message` table exists (3.8) — we don't query a table that isn't there.
 */
export async function getAdminNavCounts(): Promise<AdminNavCounts> {
  try {
    const supabase = getAdminClient();
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

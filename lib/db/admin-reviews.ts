import "server-only";
import type {
  AdminReviewRow,
  ReviewCounts,
  ReviewStatus,
} from "@/lib/admin/review";
import { type AdminRead, loadAdmin } from "./admin-read";
import { createServerClient } from "./server";

export type AdminReviewsData = {
  rows: AdminReviewRow[];
  counts: ReviewCounts;
};

const EMPTY: AdminReviewsData = {
  rows: [],
  counts: { Pending: 0, Approved: 0, All: 0 },
};

/**
 * Admin reviews (TASKS 3.7). Reads every `review` row (any status) through the
 * admin's cookie session (0006 `review_admin_read` RLS policy), newest first,
 * and resolves each review's product name from a companion `product` read
 * (mirrors how `admin-categories.ts` tallies products in JS rather than leaning
 * on an embedded join). Writes go through the `admin_set_review_status` RPC
 * (0014). Degrades to empty on error so the console chrome still renders.
 */
export async function listAdminReviews(): Promise<AdminRead<AdminReviewsData>> {
  return loadAdmin("reviews", async () => {
    const supabase = await createServerClient();
    const [{ data: reviews }, { data: products }] = await Promise.all([
      supabase
        .from("review")
        .select("id, product_id, name, rating, title, body, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("product").select("id, name"),
    ]);

    const nameById = new Map((products ?? []).map((p) => [p.id, p.name]));

    const rows: AdminReviewRow[] = (reviews ?? []).map((r) => ({
      id: r.id,
      productName: nameById.get(r.product_id) ?? "Unknown product",
      author: r.name,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status as ReviewStatus,
      createdAt: r.created_at,
    }));

    const counts: ReviewCounts = {
      Pending: rows.filter((r) => r.status === "pending").length,
      Approved: rows.filter((r) => r.status === "approved").length,
      All: rows.length,
    };

    return { rows, counts };
  }, EMPTY);
}

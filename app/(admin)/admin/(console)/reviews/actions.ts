"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import type { ReviewStatus } from "@/lib/admin/review";
import { createServerClient } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

export type ReviewActionResult = { ok: boolean; error?: string };

function messageFor(raw: string): string {
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that.";
  if (raw.includes("REVIEW_NOT_FOUND")) return "That review no longer exists.";
  if (raw.includes("INVALID_STATUS")) return "Pick a valid review status.";
  return "Couldn't update the review. Please try again.";
}

/**
 * Approve or reject a review through the admin-only `admin_set_review_status`
 * RPC (0014). The RPC re-checks admin + a valid status; the storefront's public
 * RLS policy then shows only `approved` rows, so an approve/reject takes effect
 * on the product page immediately (those pages are dynamically rendered).
 */
export async function setReviewStatus(
  id: string,
  status: ReviewStatus,
): Promise<ReviewActionResult> {
  await requireAdmin(ROUTES.adminReviews);

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("admin_set_review_status", {
    p_id: id,
    p_status: status,
  });

  if (error) return { ok: false, error: messageFor(error.message) };

  revalidatePath(ROUTES.adminReviews);
  return { ok: true };
}

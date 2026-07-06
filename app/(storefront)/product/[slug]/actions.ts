"use server";

import { reviewSchema, type ReviewFormValues } from "@/lib/review/schema";
import { createServerClient, getCurrentUser } from "@/lib/db/server";

export type SubmitReviewResult =
  | { ok: true }
  | {
      ok: false;
      /** Per-field messages keyed by form field, for inline display. */
      fieldErrors: Partial<Record<keyof ReviewFormValues, string>>;
      /** A top-level message when the failure isn't field-specific. */
      formError?: string;
    };

const DECLINE_MESSAGE =
  "We couldn't submit your review just now. Please try again in a moment.";

/**
 * Customer review submission (TASKS 4.15). Re-validates the shared schema
 * server-side, then hands it to the `submit_review` SECURITY DEFINER RPC,
 * which requires a signed-in caller, rejects a second review on the same
 * product from the same account, and lands the row as `pending` for the
 * existing moderation queue (0014) — no new admin-side code needed.
 */
export async function submitReview(
  productId: string,
  input: unknown,
): Promise<SubmitReviewResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      fieldErrors: {},
      formError: "Please sign in to write a review.",
    };
  }

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const fieldErrors: Partial<Record<keyof ReviewFormValues, string>> = {};
    for (const [key, messages] of Object.entries(flat)) {
      const first = messages?.[0];
      if (first) fieldErrors[key as keyof ReviewFormValues] = first;
    }
    return {
      ok: false,
      fieldErrors,
      formError: "Please correct the highlighted fields and try again.",
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("submit_review", {
    p_product_id: productId,
    p_rating: parsed.data.rating,
    p_title: parsed.data.title || null,
    p_body: parsed.data.body,
    p_name: parsed.data.name,
  });

  if (error) {
    if (error.message?.includes("ALREADY_REVIEWED")) {
      return {
        ok: false,
        fieldErrors: {},
        formError: "You've already reviewed this product.",
      };
    }
    console.error("submit_review failed", error);
    return { ok: false, fieldErrors: {}, formError: DECLINE_MESSAGE };
  }

  return { ok: true };
}

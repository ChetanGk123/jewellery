"use server";

import {
  type CheckoutFormValues,
  checkoutSchema,
} from "@/lib/checkout/schema";

/**
 * Server-side checkout validation (TASKS 2.4). A Server Action runs with the
 * same trust level as a public endpoint, so it re-validates the submitted
 * address against the SAME schema the client used — the client resolver is a UX
 * nicety, this is the authoritative gate.
 *
 * Order creation itself (writing `order` + `order_item` with server-recomputed,
 * integer-paise totals under scoped RLS) is TASKS 2.5. This action deliberately
 * stops at validation and returns a typed result; the success branch is where
 * 2.5 will insert the order and redirect to the confirmation page.
 */

export type CheckoutActionResult =
  | { ok: true }
  | {
      ok: false;
      /** Per-field messages keyed by form field, for inline display. */
      fieldErrors: Partial<Record<keyof CheckoutFormValues, string>>;
      /** A top-level message when the failure isn't field-specific. */
      formError?: string;
    };

export async function submitCheckout(
  values: unknown,
): Promise<CheckoutActionResult> {
  const parsed = checkoutSchema.safeParse(values);

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const fieldErrors: Partial<Record<keyof CheckoutFormValues, string>> = {};
    for (const [key, messages] of Object.entries(flat)) {
      const first = messages?.[0];
      if (first) {
        fieldErrors[key as keyof CheckoutFormValues] = first;
      }
    }
    return {
      ok: false,
      fieldErrors,
      formError: "Please correct the highlighted fields and try again.",
    };
  }

  // TASKS 2.5 lands here: recompute totals from the DB, insert order +
  // order_item under RLS, then redirect to the confirmation page.
  return { ok: true };
}

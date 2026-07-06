"use server";

import { revalidatePath, updateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/db/cache";
import { createServerClient, getCurrentUser } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

export type CancelOrderResult = { ok: true } | { ok: false; error: string };

const DECLINE_MESSAGE =
  "We couldn't cancel this order just now. Please try again in a moment.";

/**
 * Customer-initiated cancel for one of the signed-in user's own orders
 * (TASKS 4.14). Session is re-checked here — client gating is UX only — and
 * the `customer_cancel_order` RPC re-verifies ownership + the Pending-only
 * rule server-side regardless.
 */
export async function cancelMyOrder(orderNo: string): Promise<CancelOrderResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Your session has expired. Please sign in again." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("customer_cancel_order", {
    p_order_no: orderNo,
  });

  if (error) {
    console.error("customer_cancel_order failed", error);
    if (error.message?.includes("ORDER_NOT_CANCELLABLE")) {
      return {
        ok: false,
        error:
          "This order has already moved past Pending and can no longer be cancelled here.",
      };
    }
    return { ok: false, error: DECLINE_MESSAGE };
  }

  revalidatePath(ROUTES.accountOrder(orderNo));
  revalidatePath(ROUTES.accountOrders);
  // Cancelling restores stock, which the cached catalog displays.
  updateTag(CACHE_TAGS.products);
  return { ok: true };
}

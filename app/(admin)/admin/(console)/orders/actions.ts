"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { CACHE_TAGS } from "@/lib/db/cache";
import { ORDER_STATUSES } from "@/lib/db/admin-orders";
import { createServerClient } from "@/lib/db/server";
import type { OrderStatusEmailKind } from "@/lib/email/order-status";
import { queueOrderStatusEmail } from "@/lib/email/send";
import { ROUTES } from "@/lib/routes";

export type StatusActionResult = { ok: boolean; error?: string };

const VALID = new Set<string>(ORDER_STATUSES);

/** The statuses that notify the customer by email (TASKS 5.2). */
const NOTIFY = new Set<string>(["Shipped", "Delivered", "Cancelled"]);

/** Friendly messages for the RPC's raised exceptions (see 0007). */
function messageFor(raw: string): string {
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that.";
  if (raw.includes("ORDER_NOT_FOUND")) return "That order no longer exists.";
  if (raw.includes("ORDER_TERMINAL"))
    return "This order is already delivered or cancelled.";
  if (raw.includes("INVALID_TRANSITION"))
    return "That status change isn't allowed from here.";
  return "Couldn't update the order. Please try again.";
}

/**
 * Advance an order one step (or cancel it) via the admin-only
 * `admin_set_order_status` RPC (0007). The RPC re-checks admin + the transition
 * rules server-side; this action adds the authoritative `requireAdmin` gate and
 * a light input guard, then revalidates the queue so the new status shows.
 */
export async function setOrderStatus(
  orderId: string,
  nextStatus: string,
): Promise<StatusActionResult> {
  await requireAdmin(ROUTES.adminOrders);

  if (!orderId || !VALID.has(nextStatus)) {
    return { ok: false, error: "Invalid status change." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("admin_set_order_status", {
    p_order_id: orderId,
    p_status: nextStatus,
  });

  if (error) {
    return { ok: false, error: messageFor(error.message) };
  }

  // Notify the customer on the statuses that matter to them (TASKS 5.2).
  // Best-effort: read the order authoritatively (admin RLS) and queue — an
  // email hiccup must never fail an already-applied status change.
  if (NOTIFY.has(nextStatus)) {
    const { data: order } = await supabase
      .from("order")
      .select("order_no, customer_email, customer_name, total_paise")
      .eq("id", orderId)
      .maybeSingle();
    if (order?.customer_email) {
      queueOrderStatusEmail({
        to: order.customer_email,
        kind: nextStatus as OrderStatusEmailKind,
        orderNo: order.order_no,
        customerName: order.customer_name,
        totalPaise: order.total_paise,
      });
    }
  }

  revalidatePath(ROUTES.adminOrders);
  // A Cancel restores stock, which the cached catalog displays.
  updateTag(CACHE_TAGS.products);
  return { ok: true };
}

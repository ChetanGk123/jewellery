"use server"

import { revalidatePath, updateTag } from "next/cache"
import { CACHE_TAGS } from "@/lib/db/cache"
import { createServerClient, getCurrentUser } from "@/lib/db/server"
import { queueOrderStatusEmail } from "@/lib/email/send"
import { queueAdminPush } from "@/lib/push/send"
import { ROUTES } from "@/lib/routes"

export type CancelOrderResult = { ok: true } | { ok: false; error: string }

const DECLINE_MESSAGE = "We couldn't cancel this order just now. Please try again in a moment."

/**
 * Customer-initiated cancel for one of the signed-in user's own orders
 * (TASKS 4.14). Session is re-checked here — client gating is UX only — and
 * the `customer_cancel_order` RPC re-verifies ownership + the Pending-only
 * rule server-side regardless.
 */
export async function cancelMyOrder(orderNo: string): Promise<CancelOrderResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, error: "Your session has expired. Please sign in again." }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("customer_cancel_order", {
    p_order_no: orderNo,
  })

  if (error) {
    console.error("customer_cancel_order failed", error)
    if (error.message?.includes("ORDER_NOT_CANCELLABLE")) {
      return {
        ok: false,
        error: "This order has already moved past Pending and can no longer be cancelled here.",
      }
    }
    return { ok: false, error: DECLINE_MESSAGE }
  }

  // Confirm the cancellation by email (TASKS 5.2). Best-effort: read the order
  // authoritatively (own-row RLS) and queue — never fail the completed cancel.
  const { data: order } = await supabase
    .from("order")
    .select("order_no, customer_email, customer_name, total_paise")
    .eq("order_no", orderNo)
    .maybeSingle()
  if (order?.customer_email) {
    await queueOrderStatusEmail({
      to: order.customer_email,
      kind: "Cancelled",
      orderNo: order.order_no,
      customerName: order.customer_name,
      totalPaise: order.total_paise,
    })
  }

  // System notification to subscribed admin devices (6.17). Same tag as the
  // new-order push, so a quick place-then-cancel collapses into one alert.
  queueAdminPush({
    title: `Order ${orderNo} cancelled`,
    body: order?.customer_name
      ? `Cancelled by ${order.customer_name} while still Pending.`
      : "Cancelled by the customer while still Pending.",
    url: ROUTES.adminOrders,
    tag: `order-${orderNo}`,
  })

  revalidatePath(ROUTES.accountOrder(orderNo))
  revalidatePath(ROUTES.accountOrders)
  // Cancelling restores stock, which the cached catalog displays.
  updateTag(CACHE_TAGS.products)
  return { ok: true }
}

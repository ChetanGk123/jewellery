"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"
import { createServerClient } from "@/lib/db/server"
import { getReturnSettings } from "@/lib/db/settings"
import { queueReturnStatusEmail } from "@/lib/email/send"
import type { ReturnEmailKind } from "@/lib/email/return-status"
import { type ReturnStatus, SHIPPING_PAYER_CUSTOMER_COPY } from "@/lib/returns"
import { ROUTES } from "@/lib/routes"

export type ReturnActionResult = { ok: boolean; error?: string }

function messageFor(raw: string): string {
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that."
  if (raw.includes("RETURN_NOT_FOUND")) return "That return request no longer exists."
  if (raw.includes("INVALID_RETURN_TRANSITION"))
    return "That move isn't allowed from the request's current state — refresh and try again."
  if (raw.includes("REFUND_DETAILS_REQUIRED"))
    return "Recording a refund needs the paid amount and the UPI reference (UTR)."
  return "Couldn't update the return request. Please try again."
}

export type SetReturnStatusInput = {
  id: string
  status: ReturnStatus
  /** Refunded only: what was actually paid back, in whole rupees. */
  refundAmountRupees?: number
  /** Refunded only: the UPI transaction reference (UTR). */
  refundReference?: string
  /** Optional operator note; shown to the customer on a rejection. */
  note?: string
}

/**
 * Advance a return request (TASKS 8.7d) through the admin-only
 * `admin_set_return_status` RPC (0043), which enforces the legal transitions
 * (Requested → Approved/Rejected → Received → Refunded/Exchanged) and, for
 * Refunded, requires amount + reference and flips the order's
 * `payment_status` to `refunded` — the record that makes COD cash reconcile.
 * The rupees→paise conversion happens here at the boundary (CLAUDE.md §2).
 */
export async function setReturnStatus(input: SetReturnStatusInput): Promise<ReturnActionResult> {
  await requireAdmin(ROUTES.adminReturns)

  const isRefund = input.status === "Refunded"
  if (isRefund) {
    const amount = input.refundAmountRupees
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || (amount ?? 0) <= 0) {
      return { ok: false, error: "Enter the refunded amount in whole rupees." }
    }
    if (!input.refundReference?.trim()) {
      return { ok: false, error: "Enter the UPI transaction reference (UTR)." }
    }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_set_return_status", {
    p_return_id: input.id,
    p_status: input.status,
    p_refund_amount_paise: isRefund ? Math.round((input.refundAmountRupees ?? 0) * 100) : undefined,
    p_refund_reference: isRefund ? input.refundReference?.trim() : undefined,
    p_admin_note: input.note?.trim() || undefined,
  })

  if (error) return { ok: false, error: messageFor(error.message) }

  // Customer notification (8.7e) — every transition except the internal
  // "Received" step emails the customer. Best-effort after the committed
  // write: read the request + order back (admin RLS) and queue.
  const emailKind: ReturnEmailKind | null =
    input.status === "Approved" || input.status === "Rejected" ||
    input.status === "Refunded" || input.status === "Exchanged"
      ? input.status
      : null
  if (emailKind) {
    const { data: request } = await supabase
      .from("return_request")
      .select(
        "resolution, admin_note, refund_amount_paise, refund_reference, order!inner(order_no, customer_name, customer_email)",
      )
      .eq("id", input.id)
      .maybeSingle()
    if (request?.order.customer_email) {
      const shippingNote =
        emailKind === "Approved"
          ? SHIPPING_PAYER_CUSTOMER_COPY[(await getReturnSettings()).shippingPayer]
          : undefined
      await queueReturnStatusEmail({
        to: request.order.customer_email,
        kind: emailKind,
        orderNo: request.order.order_no,
        customerName: request.order.customer_name,
        resolution: request.resolution,
        shippingNote,
        refundAmountPaise: request.refund_amount_paise,
        refundReference: request.refund_reference,
        operatorNote: request.admin_note,
      })
    }
  }

  revalidatePath(ROUTES.adminReturns)
  return { ok: true }
}

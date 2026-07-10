"use server"

import { revalidatePath, updateTag } from "next/cache"
import { ORDER_NO_RE } from "@/lib/checkout/order"
import { CACHE_TAGS } from "@/lib/db/cache"
import { createServerClient, getCurrentUser } from "@/lib/db/server"
import {
  queueOrderStatusEmail,
  queueReturnAdminEmail,
  queueReturnStatusEmail,
} from "@/lib/email/send"
import { queueAdminPush } from "@/lib/push/send"
import {
  MAX_RETURN_PHOTOS,
  MIN_RETURN_PHOTOS,
  RETURN_PHOTO_MAX_BYTES,
  returnRequestSchema,
} from "@/lib/returns"
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

export type RequestReturnResult = { ok: true } | { ok: false; error: string }

const RETURN_BUCKET = "return-photos"

const RETURN_DECLINE_MESSAGE =
  "We couldn't submit your return request just now. Please try again in a moment."

/** Friendly messages for the `customer_request_return` failure codes (0043). */
const RETURN_RPC_ERRORS: Array<{ code: string; message: string }> = [
  {
    code: "RETURN_WINDOW_CLOSED",
    message:
      "The return window for this order has closed. Reach us on WhatsApp if something is wrong with your piece.",
  },
  {
    code: "RETURNS_DISABLED",
    message: "Returns aren't available right now. Reach us on WhatsApp and we'll sort it out.",
  },
  {
    code: "RETURN_EXISTS",
    message: "A return has already been requested for this order.",
  },
  {
    code: "ORDER_NOT_RETURNABLE",
    message: "Only delivered orders can be returned.",
  },
  {
    code: "INVALID_UPI",
    message: "That UPI ID doesn't look right — please check it (like name@bank).",
  },
]

/**
 * Customer "Request return" on a Delivered order (TASKS 8.7c). Field
 * validation mirrors `customer_request_return`, which re-verifies everything
 * server-side (ownership, Delivered, the settings window, one-per-order, the
 * photo paths). Photos are REQUIRED (operator decision): 1–3 images upload
 * into the caller's own folder of the private `return-photos` bucket (RLS
 * 0043) before the RPC records their paths. If the RPC then declines, the
 * uploads stay behind as orphans — customers can't delete from the bucket,
 * and losing evidence files would be worse; admins can prune.
 */
export async function requestReturn(formData: FormData): Promise<RequestReturnResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, error: "Your session has expired. Please sign in again." }
  }

  const orderNo = String(formData.get("orderNo") ?? "")
  if (!ORDER_NO_RE.test(orderNo)) {
    return { ok: false, error: RETURN_DECLINE_MESSAGE }
  }

  const parsed = returnRequestSchema.safeParse({
    reason: String(formData.get("reason") ?? ""),
    resolution: String(formData.get("resolution") ?? ""),
    upiId: String(formData.get("upiId") ?? ""),
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? RETURN_DECLINE_MESSAGE }
  }

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0)
  if (photos.length < MIN_RETURN_PHOTOS) {
    return { ok: false, error: "Please attach at least one photo of the item." }
  }
  if (photos.length > MAX_RETURN_PHOTOS) {
    return { ok: false, error: `Please attach at most ${MAX_RETURN_PHOTOS} photos.` }
  }
  for (const photo of photos) {
    if (!photo.type.startsWith("image/")) {
      return { ok: false, error: "Photos must be image files." }
    }
    if (photo.size > RETURN_PHOTO_MAX_BYTES) {
      return { ok: false, error: "Each photo must be under 5 MB." }
    }
  }

  // Upload into the caller's own folder — the path prefix is what the RPC and
  // the bucket RLS both verify.
  const supabase = await createServerClient()
  const paths: string[] = []
  for (const photo of photos) {
    const ext = (photo.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
    const path = `${user.id}/${orderNo}/${crypto.randomUUID()}.${ext || "jpg"}`
    const { error } = await supabase.storage
      .from(RETURN_BUCKET)
      .upload(path, photo, { contentType: photo.type, upsert: false })
    if (error) {
      console.error("return photo upload failed", error)
      return { ok: false, error: "Photo upload failed. Please try again." }
    }
    paths.push(path)
  }

  const { error } = await supabase.rpc("customer_request_return", {
    p_order_no: orderNo,
    p_reason: parsed.data.reason,
    p_resolution: parsed.data.resolution,
    p_upi_id: parsed.data.upiId || undefined,
    p_photos: paths,
  })

  if (error) {
    console.error("customer_request_return failed", error)
    const known = RETURN_RPC_ERRORS.find((entry) => error.message?.includes(entry.code))
    return { ok: false, error: known?.message ?? RETURN_DECLINE_MESSAGE }
  }

  // Notifications (8.7e), all best-effort after the committed request:
  // confirmation email to the customer, alert email + push to the operator.
  const { data: order } = await supabase
    .from("order")
    .select("customer_email, customer_name")
    .eq("order_no", orderNo)
    .maybeSingle()
  if (order?.customer_email) {
    await queueReturnStatusEmail({
      to: order.customer_email,
      kind: "Requested",
      orderNo,
      customerName: order.customer_name,
      resolution: parsed.data.resolution,
    })
  }
  await queueReturnAdminEmail({
    orderNo,
    customerName: order?.customer_name ?? "",
    resolution: parsed.data.resolution,
    reason: parsed.data.reason,
  })
  queueAdminPush({
    title: `Return requested — ${orderNo}`,
    body: `${parsed.data.resolution === "refund" ? "Refund" : "Exchange"} requested: ${parsed.data.reason.slice(0, 80)}`,
    url: ROUTES.adminReturns,
    tag: `return-${orderNo}`,
  })

  revalidatePath(ROUTES.accountOrder(orderNo))
  return { ok: true }
}

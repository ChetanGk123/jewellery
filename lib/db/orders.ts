import "server-only"
import { type OrderConfirmation, toOrderConfirmation } from "@/lib/checkout/order"
import { createServerClient } from "./server"

/**
 * Fetch the confirmation view of one order by its (unguessable) order number,
 * via the read-only `get_order_confirmation` SECURITY DEFINER RPC — the `order`
 * table itself is RLS-sealed. Returns null when the number is unknown so the
 * page can `notFound()`. Throws on an unexpected RPC error.
 */
export async function getOrderConfirmation(orderNo: string): Promise<OrderConfirmation | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc("get_order_confirmation", {
    p_order_no: orderNo,
  })

  if (error) {
    throw new Error(`getOrderConfirmation failed: ${error.message}`)
  }

  return toOrderConfirmation(data)
}

/** One row of the signed-in customer's order history. */
export type MyOrderSummary = {
  orderNo: string
  status: string
  createdAt: string
  totalPaise: number
  itemCount: number
}

/**
 * The signed-in customer's orders, newest first. Runs as the user through the
 * cookie-aware client, so the "customer reads own orders" RLS policy scopes
 * the rows — no explicit user filter needed (and none would be trustworthy).
 */
export async function listMyOrders(): Promise<MyOrderSummary[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("order")
    .select("order_no, status, created_at, total_paise, order_item(count)")
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`listMyOrders failed: ${error.message}`)
  }

  return (data ?? []).map((row) => ({
    orderNo: row.order_no,
    status: row.status,
    createdAt: row.created_at,
    totalPaise: row.total_paise,
    itemCount: row.order_item[0]?.count ?? 0,
  }))
}

/** One line item on an order detail view. */
export type MyOrderItem = {
  name: string
  tone: string | null
  qty: number
  unitPricePaise: number
  lineTotalPaise: number
  /** Product-page slug for the "Write a review" link on Delivered orders (6.18). */
  productSlug: string | null
}

/** The customer-visible slice of this order's return request (TASKS 8.7). */
export type MyReturnRequest = {
  status: string
  resolution: string
  upiId: string | null
  refundAmountPaise: number | null
  refundReference: string | null
  /** Operator note — surfaced to the customer only on a rejection. */
  adminNote: string | null
  createdAt: string
  resolvedAt: string | null
}

/** Full detail for one of the signed-in customer's own orders (TASKS 4.14). */
export type MyOrderDetail = {
  orderNo: string
  status: string
  createdAt: string
  /** When the order reached Delivered — anchors the return window (8.7). */
  deliveredAt: string | null
  customerName: string
  customerPhone: string
  customerEmail: string
  addressLine: string
  city: string
  state: string
  pincode: string
  subtotalPaise: number
  discountPaise: number
  shippingPaise: number
  totalPaise: number
  /** Courier tracking number, once the operator records it (6.4 follow-up). */
  awb: string | null
  /** Courier tracking page — when set, the AWB renders as a link (6.4c). */
  trackingUrl: string | null
  /** The order's return request, once one exists (one per order, 8.7). */
  returnRequest: MyReturnRequest | null
  items: MyOrderItem[]
}

/**
 * Full detail for one order, scoped to the signed-in customer via the same
 * "customer reads own orders"/"customer reads own order items" RLS policies
 * as `listMyOrders` — no explicit user filter needed (and none would be
 * trustworthy). Returns null when the order number doesn't exist OR belongs
 * to someone else, so the page can `notFound()` either way.
 */
export async function getMyOrderDetail(orderNo: string): Promise<MyOrderDetail | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("order")
    .select(
      "order_no, status, created_at, delivered_at, customer_name, customer_phone, customer_email, address_line, city, state, pincode, subtotal_paise, discount_paise, shipping_paise, total_paise, awb, tracking_url, return_request(status, resolution, upi_id, refund_amount_paise, refund_reference, admin_note, created_at, resolved_at), order_item(name, tone, qty, unit_price_paise, line_total_paise, product(slug))",
    )
    .eq("order_no", orderNo)
    .maybeSingle()

  if (error) {
    throw new Error(`getMyOrderDetail failed: ${error.message}`)
  }
  if (!data) return null

  return {
    orderNo: data.order_no,
    status: data.status,
    createdAt: data.created_at,
    deliveredAt: data.delivered_at,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerEmail: data.customer_email,
    addressLine: data.address_line,
    city: data.city,
    state: data.state,
    pincode: data.pincode,
    subtotalPaise: data.subtotal_paise,
    discountPaise: data.discount_paise,
    shippingPaise: data.shipping_paise,
    totalPaise: data.total_paise,
    awb: data.awb,
    trackingUrl: data.tracking_url,
    returnRequest: data.return_request
      ? {
          status: data.return_request.status,
          resolution: data.return_request.resolution,
          upiId: data.return_request.upi_id,
          refundAmountPaise: data.return_request.refund_amount_paise,
          refundReference: data.return_request.refund_reference,
          adminNote: data.return_request.admin_note,
          createdAt: data.return_request.created_at,
          resolvedAt: data.return_request.resolved_at,
        }
      : null,
    items: data.order_item.map((item) => ({
      name: item.name,
      tone: item.tone,
      qty: item.qty,
      unitPricePaise: item.unit_price_paise,
      lineTotalPaise: item.line_total_paise,
      productSlug: item.product?.slug ?? null,
    })),
  }
}

/**
 * Whether the signed-in customer has a Delivered order containing this
 * product — the "Verified Purchase" gate for review submission (TASKS 4.15
 * follow-up). Scoped by the same "customer reads own orders"/"own order
 * items" RLS policies as the rest of this file; mirrors the check the
 * `submit_review` RPC (0022) enforces server-side regardless.
 */
export async function hasDeliveredPurchase(productId: string): Promise<boolean> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("order")
    .select("id, order_item!inner(product_id)")
    .eq("status", "Delivered")
    .eq("order_item.product_id", productId)
    .limit(1)

  if (error) {
    throw new Error(`hasDeliveredPurchase failed: ${error.message}`)
  }
  return (data ?? []).length > 0
}

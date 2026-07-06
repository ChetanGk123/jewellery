/**
 * Pure order-payload types + validation for the checkout write path (TASKS 2.5).
 * No React/server-only deps: the mapper turns cart lines into the minimal
 * `{ productId, tone, qty }` items the server needs (prices are NOT sent — the
 * `place_order` RPC recomputes every total from the DB), and the result parser
 * narrows the RPC's untyped jsonb return into a typed `PlacedOrder`.
 */

import { z } from "zod";
import type { CartLine } from "@/lib/cart";
import { MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from "@/lib/cart";

/** One line the client asks the server to price — never carries a price/total. */
export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  tone: z.string().nullable(),
  qty: z.number().int().min(MIN_LINE_QUANTITY).max(MAX_LINE_QUANTITY),
});
export type OrderItemInput = z.infer<typeof orderItemSchema>;

/** The cart must contain at least one valid line to check out. */
export const orderItemsSchema = z.array(orderItemSchema).min(1);

/** Strip cart lines down to the price-free payload the server will re-price. */
export function cartLinesToOrderItems(
  lines: readonly CartLine[],
): OrderItemInput[] {
  return lines.map((line) => ({
    productId: line.productId,
    tone: line.optionValue,
    qty: line.quantity,
  }));
}

/** Server-recomputed order summary (camelCase) returned to the client. */
export type PlacedOrder = {
  /** Unguessable order number (JR-YYMMDD-####-XXXX) — the confirmation URL key. */
  orderNo: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  /**
   * True when a coupon was entered but couldn't be applied (expired/exhausted/
   * below-minimum between the cart preview and placement). The order still
   * stands at the recomputed total; checkout surfaces a notice (TASKS 3.6b).
   */
  couponDropped: boolean;
};

/** Shape of the `place_order` RPC's jsonb return (snake_case, integer paise). */
const placedOrderResultSchema = z.object({
  order_no: z.string().min(1),
  subtotal_paise: z.number().int(),
  discount_paise: z.number().int(),
  shipping_paise: z.number().int(),
  total_paise: z.number().int(),
  // Optional for back-compat with pre-3.6b returns (defaults to false).
  coupon_dropped: z.boolean().optional(),
});

/** Narrow the untyped RPC return into a typed `PlacedOrder` (null on mismatch). */
export function toPlacedOrder(raw: unknown): PlacedOrder | null {
  const parsed = placedOrderResultSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    orderNo: parsed.data.order_no,
    subtotalPaise: parsed.data.subtotal_paise,
    discountPaise: parsed.data.discount_paise,
    shippingPaise: parsed.data.shipping_paise,
    totalPaise: parsed.data.total_paise,
    couponDropped: parsed.data.coupon_dropped ?? false,
  };
}

/** Order number shape (JR-YYMMDD-####-XXXX) — reject junk paths before the DB. */
export const ORDER_NO_RE = /^JR-\d{6}-\d{4,}-[0-9A-Z]{4}$/;

/** Non-sensitive confirmation view of a placed order (for `/order/[id]`). */
export type OrderConfirmation = {
  orderNo: string;
  status: string;
  paymentMethod: string;
  customerEmail: string;
  totalPaise: number;
  createdAt: string;
};

/** Shape of the `get_order_confirmation` RPC's jsonb return. */
const orderConfirmationResultSchema = z.object({
  order_no: z.string().min(1),
  status: z.string().min(1),
  payment_method: z.string().min(1),
  customer_email: z.string().min(1),
  total_paise: z.number().int(),
  created_at: z.string().min(1),
});

/** Narrow the untyped RPC return into a typed `OrderConfirmation` (null on miss). */
export function toOrderConfirmation(raw: unknown): OrderConfirmation | null {
  const parsed = orderConfirmationResultSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    orderNo: parsed.data.order_no,
    status: parsed.data.status,
    paymentMethod: parsed.data.payment_method,
    customerEmail: parsed.data.customer_email,
    totalPaise: parsed.data.total_paise,
    createdAt: parsed.data.created_at,
  };
}

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
  orderNo: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
};

/** Shape of the `place_order` RPC's jsonb return (snake_case, integer paise). */
const placedOrderResultSchema = z.object({
  order_no: z.string().min(1),
  subtotal_paise: z.number().int(),
  discount_paise: z.number().int(),
  shipping_paise: z.number().int(),
  total_paise: z.number().int(),
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
  };
}

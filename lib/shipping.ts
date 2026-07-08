/**
 * Pure shipping/free-ship logic for the cart and (later) checkout. No React or
 * storage deps — just money maths over integer paise, so it's unit testable in
 * isolation (mirrors `lib/cart` and `lib/utils/money`).
 *
 * The free-ship threshold is store-configurable (`setting.free_ship_threshold_paise`
 * via `getStoreSettings`); the flat fee below it is a v1 constant (matches the
 * "₹79 flat" rate in the Shipping page copy). COD handling is a checkout concern
 * (2.4), not part of the cart shipping line.
 */

/**
 * Fallback flat delivery fee (paise) when a caller doesn't pass the store's
 * configured rate. The real value is `setting.flat_rate_paise` (Settings 3.11),
 * threaded through `shippingPaise` from `getStoreSettings`; `place_order`
 * recomputes from the same column server-side. This constant only backstops
 * callers/tests that don't supply one.
 */
export const FLAT_SHIPPING_PAISE = 7900

/**
 * Delivery fee for a cart, in paise: free once the subtotal reaches the
 * threshold, otherwise the store's flat fee. An empty cart (subtotal ≤ 0) ships
 * free. `flatRatePaise` comes from store settings; defaults to the fallback.
 */
export function shippingPaise(
  subtotalPaise: number,
  freeThresholdPaise: number,
  flatRatePaise: number = FLAT_SHIPPING_PAISE,
): number {
  if (subtotalPaise <= 0) return 0
  return subtotalPaise >= freeThresholdPaise ? 0 : flatRatePaise
}

/**
 * How much more (in paise) the customer must spend to unlock free shipping —
 * 0 once they've qualified. Drives the "Add ₹X more for free shipping" hint.
 */
export function amountToFreeShipPaise(subtotalPaise: number, freeThresholdPaise: number): number {
  return Math.max(0, freeThresholdPaise - subtotalPaise)
}

/** Whether the cart already qualifies for free shipping. */
export function qualifiesForFreeShipping(
  subtotalPaise: number,
  freeThresholdPaise: number,
): boolean {
  return subtotalPaise > 0 && subtotalPaise >= freeThresholdPaise
}

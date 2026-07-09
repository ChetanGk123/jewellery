/**
 * Money helpers. Prices are stored as integer paise (1 rupee = 100 paise) and
 * only formatted in the UI layer. See CLAUDE.md / ARCHITECTURE_PLAN.md §2.
 */

const PAISE_PER_RUPEE = 100

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const inrFormatterWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Convert integer paise to a rupee number (may be fractional). */
export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE
}

/**
 * Format integer paise as an Indian-rupee string, e.g. 249900 -> "₹2,499".
 * Pass `withDecimals` for exact paise, e.g. 249950 -> "₹2,499.50".
 */
export function formatPaise(paise: number, opts: { withDecimals?: boolean } = {}): string {
  const rupees = paiseToRupees(paise)
  const formatter =
    opts.withDecimals || !Number.isInteger(rupees) ? inrFormatterWithPaise : inrFormatter
  return formatter.format(rupees)
}

/**
 * Discount percentage from mrp to price (both in paise), rounded to an integer.
 * Returns 0 when there is no valid saving.
 */
export function discountPercent(pricePaise: number, mrpPaise: number | null | undefined): number {
  if (!mrpPaise || mrpPaise <= pricePaise) return 0
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100)
}

/**
 * The admin "Price / Sale price" pair (rupees) → stored columns. "Sale price"
 * is what the customer pays, so a valid sale below the price becomes
 * `pricePaise` while the higher price becomes the strike-through `mrpPaise`;
 * otherwise the price is charged as-is with no MRP. Shared by the single
 * product upsert and the bulk import so the mapping can't drift.
 */
export function pricePairFromRupees(
  priceRupees: number,
  saleRupees: number | null,
): { pricePaise: number; mrpPaise: number | null } {
  if (saleRupees != null && saleRupees > 0 && saleRupees < priceRupees) {
    return { pricePaise: Math.round(saleRupees * 100), mrpPaise: Math.round(priceRupees * 100) }
  }
  return { pricePaise: Math.round(priceRupees * 100), mrpPaise: null }
}

/**
 * Stored columns → the admin "Price / Sale price" pair (rupees). Inverse of
 * `pricePairFromRupees`; used when exporting products so the sheet shows the
 * same two numbers the edit modal would.
 */
export function rupeesFromPricePair(
  pricePaise: number,
  mrpPaise: number | null,
): { priceRupees: number; saleRupees: number | null } {
  if (mrpPaise != null && mrpPaise > pricePaise) {
    return { priceRupees: paiseToRupees(mrpPaise), saleRupees: paiseToRupees(pricePaise) }
  }
  return { priceRupees: paiseToRupees(pricePaise), saleRupees: null }
}

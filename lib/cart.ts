/**
 * Pure cart domain logic — the line model, mutations, and derived totals. This
 * module has no React or storage dependencies (those live in `stores/cart.ts`),
 * so every operation is a pure function over an immutable line array and is unit
 * testable in isolation.
 *
 * Prices are integer-paise snapshots taken when an item is added and are for
 * display only. Order totals are recomputed server-side at checkout and never
 * trusted from the client (see TASKS.md 2.5).
 */

export const MIN_LINE_QUANTITY = 1
export const MAX_LINE_QUANTITY = 10

/** A product (optionally a specific variant) a customer intends to buy. */
export type CartLine = {
  /** Stable line key: product id, plus the option value when a variant is chosen. */
  id: string
  productId: string
  slug: string
  name: string
  categoryName: string
  /** Unit price snapshot in paise (display only; server recomputes at checkout). */
  pricePaise: number
  /** MRP snapshot in paise for struck-through savings, or null when none. */
  mrpPaise: number | null
  imageUrl: string | null
  imageBg: string | null
  /** Chosen variant (e.g. plating tone) when the product has options, else null. */
  optionLabel: string | null
  optionValue: string | null
  quantity: number
}

/** Everything needed to add a line except its quantity and derived id. */
export type CartLineInput = Omit<CartLine, "id" | "quantity">

/** Deterministic line key so the same product+variant merges into one line. */
export function cartLineId(productId: string, optionValue?: string | null): string {
  return optionValue ? `${productId}:${optionValue}` : productId
}

/** Coerce any incoming quantity into a whole number within the allowed bounds. */
function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return MIN_LINE_QUANTITY
  const whole = Math.floor(quantity)
  if (whole < MIN_LINE_QUANTITY) return MIN_LINE_QUANTITY
  if (whole > MAX_LINE_QUANTITY) return MAX_LINE_QUANTITY
  return whole
}

/**
 * Add `quantity` of a product to the cart. If a line for the same
 * product+variant already exists its quantity is merged (capped at
 * MAX_LINE_QUANTITY); otherwise a new line is appended. Returns a new array —
 * never mutates the input.
 */
export function addLine(
  lines: readonly CartLine[],
  input: CartLineInput,
  quantity = 1,
): CartLine[] {
  const id = cartLineId(input.productId, input.optionValue)
  const existing = lines.find((line) => line.id === id)
  if (existing) {
    return lines.map((line) =>
      line.id === id ? { ...line, quantity: clampQuantity(line.quantity + quantity) } : line,
    )
  }
  return [...lines, { ...input, id, quantity: clampQuantity(quantity) }]
}

/** Set an exact quantity for a line; a quantity of 0 or less removes it. */
export function setLineQuantity(
  lines: readonly CartLine[],
  id: string,
  quantity: number,
): CartLine[] {
  if (quantity <= 0) return removeLine(lines, id)
  return lines.map((line) =>
    line.id === id ? { ...line, quantity: clampQuantity(quantity) } : line,
  )
}

/** Remove a line from the cart entirely. */
export function removeLine(lines: readonly CartLine[], id: string): CartLine[] {
  return lines.filter((line) => line.id !== id)
}

/** Total number of individual units across all lines (for the cart badge). */
export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

/** Sum of price × quantity across all lines, in paise. */
export function cartSubtotalPaise(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.pricePaise * line.quantity, 0)
}

/** Sum of MRP × quantity (falling back to price when a line has no MRP), in paise. */
export function cartMrpTotalPaise(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + (line.mrpPaise ?? line.pricePaise) * line.quantity, 0)
}

/** Total saving versus MRP across the cart, in paise (never negative). */
export function cartSavingsPaise(lines: readonly CartLine[]): number {
  return Math.max(0, cartMrpTotalPaise(lines) - cartSubtotalPaise(lines))
}

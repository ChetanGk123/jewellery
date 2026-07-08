"use client"

import { cartCount } from "@/lib/cart"
import { useCartHydrated, useCartStore } from "@/stores/cart"

/**
 * Live cart-count badge for the header. Shows 0 until the persisted cart
 * rehydrates (the server renders an empty cart), so there's no hydration
 * mismatch, then reflects the real unit count.
 */
export function CartBadge() {
  const hasHydrated = useCartHydrated()
  const lines = useCartStore((state) => state.lines)
  const count = hasHydrated ? cartCount(lines) : 0

  return (
    <span className="inline-block min-w-[20px] rounded-[10px] bg-maroon-700 px-[5px] text-center text-[11px] font-semibold leading-5 text-cream-200">
      {count}
    </span>
  )
}

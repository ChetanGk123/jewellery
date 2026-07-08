"use client"

import { useState, type ReactNode } from "react"
import type { CartLineInput } from "@/lib/cart"
import { useCartStore } from "@/stores/cart"

/** How long the "Added" confirmation stays before reverting to the label. */
const ADDED_FEEDBACK_MS = 1400

type Props = {
  input: CartLineInput
  quantity?: number
  ariaLabel: string
  className?: string
  children: ReactNode
  addedLabel?: ReactNode
  disabled?: boolean
}

/**
 * Reusable "add to cart" button that pushes a line into `useCartStore` and shows
 * a brief confirmation. Styling is passed in via `className` so the compact card
 * button and the full product-page button share one behaviour.
 */
export function AddToCartButton({
  input,
  quantity = 1,
  ariaLabel,
  className,
  children,
  addedLabel = "Added ✓",
  disabled = false,
}: Props) {
  const addItem = useCartStore((state) => state.addItem)
  const [isAdded, setIsAdded] = useState(false)

  const handleClick = () => {
    addItem(input, quantity)
    setIsAdded(true)
    window.setTimeout(() => setIsAdded(false), ADDED_FEEDBACK_MS)
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
      disabled={disabled}
      className={className}
    >
      {isAdded ? addedLabel : children}
    </button>
  )
}

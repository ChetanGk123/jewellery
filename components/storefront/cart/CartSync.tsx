"use client"

import { useEffect, useRef } from "react"
import { syncCart } from "@/app/(storefront)/cart/actions"
import type { CartLine } from "@/lib/cart"
import { useCartStore } from "@/stores/cart"

/**
 * Mirrors the localStorage cart to the server-side snapshot (TASKS 6.19) so
 * the abandoned-cart cron can see it. Renders nothing; mounted once in the
 * storefront layout. Debounced so add/remove bursts collapse into one sync,
 * and deduped against the last payload sent (the RPC also ignores identical
 * re-syncs server-side, keeping the 24h idle clock honest). The server action
 * no-ops for anonymous visitors.
 */

const SYNC_DEBOUNCE_MS = 2500

function payloadOf(lines: CartLine[]) {
  return lines.map((line) => ({
    name: line.name,
    slug: line.slug || null,
    qty: line.quantity,
    unitPricePaise: line.pricePaise,
    tone: line.optionLabel,
  }))
}

export function CartSync() {
  const lastSentKey = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const schedule = (lines: CartLine[]) => {
      const payload = payloadOf(lines)
      const key = JSON.stringify(payload)
      if (key === lastSentKey.current) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        lastSentKey.current = key
        void syncCart(payload)
      }, SYNC_DEBOUNCE_MS)
    }

    // Once on mount (covers a cart rehydrated from localStorage), then on
    // every cart change.
    schedule(useCartStore.getState().lines)
    const unsubscribe = useCartStore.subscribe((state) => schedule(state.lines))
    return () => {
      unsubscribe()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return null
}

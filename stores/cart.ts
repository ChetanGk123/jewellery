"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  addLine,
  removeLine,
  setLineQuantity,
  type CartLine,
  type CartLineInput,
} from "@/lib/cart";
import { normalizeCouponCode } from "@/lib/coupons";

/**
 * Client-side cart store — the persisted, cross-route home for the customer's
 * cart. All line maths live in the pure `lib/cart` module; this store just holds
 * the array, persists it to localStorage, and exposes actions. Derived totals
 * are computed by the pure selectors in `lib/cart` at read time (never stored).
 *
 * `couponCode` holds the applied code only; whether it's currently valid (and
 * the resulting discount) is derived from the live subtotal via `lib/coupons` at
 * read time, and recomputed authoritatively server-side at checkout (2.5).
 */

const STORAGE_KEY = "jr-cart";
const STORAGE_VERSION = 1;

type CartState = {
  lines: CartLine[];
  couponCode: string | null;
  addItem: (input: CartLineInput, quantity?: number) => void;
  setItemQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => void;
  clearCoupon: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      couponCode: null,
      addItem: (input, quantity = 1) =>
        set((state) => ({ lines: addLine(state.lines, input, quantity) })),
      setItemQuantity: (id, quantity) =>
        set((state) => ({ lines: setLineQuantity(state.lines, id, quantity) })),
      removeItem: (id) =>
        set((state) => ({ lines: removeLine(state.lines, id) })),
      clearCart: () => set({ lines: [], couponCode: null }),
      applyCoupon: (code) => set({ couponCode: normalizeCouponCode(code) }),
      clearCoupon: () => set({ couponCode: null }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/**
 * True once the persisted cart has finished rehydrating from localStorage. The
 * server (and the first client render) always render an empty cart, so consumers
 * (the cart page, the header badge) gate on this to avoid a hydration mismatch
 * and a flash of the empty cart. Initialised `false` so SSR and first paint agree,
 * then flipped via persist's own hydration signal.
 */
export function useCartHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useCartStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    // Cover the case where hydration already finished before this effect ran.
    if (useCartStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, []);

  return hydrated;
}

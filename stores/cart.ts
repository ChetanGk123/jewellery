"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  addLine,
  removeLine,
  setLineQuantity,
  type CartLine,
  type CartLineInput,
} from "@/lib/cart";

/**
 * Client-side cart store — the persisted, cross-route home for the customer's
 * cart. All line maths live in the pure `lib/cart` module; this store just holds
 * the array, persists it to localStorage, and exposes actions. Derived totals
 * are computed by the pure selectors in `lib/cart` at read time (never stored).
 */

const STORAGE_KEY = "jr-cart";
const STORAGE_VERSION = 1;

type CartState = {
  lines: CartLine[];
  /**
   * True once the persisted cart has rehydrated from localStorage. The server
   * always renders an empty cart, so consumers (e.g. the Header badge) render a
   * neutral value until this flips to avoid a hydration mismatch.
   */
  hasHydrated: boolean;
  addItem: (input: CartLineInput, quantity?: number) => void;
  setItemQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      hasHydrated: false,
      addItem: (input, quantity = 1) =>
        set((state) => ({ lines: addLine(state.lines, input, quantity) })),
      setItemQuantity: (id, quantity) =>
        set((state) => ({ lines: setLineQuantity(state.lines, id, quantity) })),
      removeItem: (id) =>
        set((state) => ({ lines: removeLine(state.lines, id) })),
      clearCart: () => set({ lines: [] }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Only the lines are persisted; `hasHydrated` must always start false and
      // is set by onRehydrateStorage once the stored lines are restored.
      partialize: (state) => ({ lines: state.lines }),
      onRehydrateStorage: () => () => {
        useCartStore.setState({ hasHydrated: true });
      },
    },
  ),
);

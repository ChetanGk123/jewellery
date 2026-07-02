"use client";

import { useState } from "react";
import { validateCoupon } from "@/lib/coupons";
import { useCartStore } from "@/stores/cart";

/**
 * Coupon entry for the order summary. Applies/clears the code on the persisted
 * cart store and validates against the live subtotal, so a code that's stored
 * but no longer valid (e.g. items removed below its minimum) surfaces a message
 * instead of a phantom discount. The authoritative check runs server-side at
 * order creation (2.5).
 */
export function CouponField({ subtotalPaise }: { subtotalPaise: number }) {
  const couponCode = useCartStore((state) => state.couponCode);
  const applyCoupon = useCartStore((state) => state.applyCoupon);
  const clearCoupon = useCartStore((state) => state.clearCoupon);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const applied = couponCode ? validateCoupon(couponCode, subtotalPaise) : null;

  const handleApply = () => {
    const result = validateCoupon(input, subtotalPaise);
    if (result.ok) {
      applyCoupon(result.coupon.code);
      setInput("");
      setError(null);
    } else {
      setError(result.message);
    }
  };

  const handleRemove = () => {
    clearCoupon();
    setError(null);
  };

  if (applied?.ok) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-sm border border-[#BFE3C6] bg-[#F2FBF4] px-3 py-2.5">
        <span className="text-[12.5px] font-medium leading-none text-[#1E7A38]">
          ✓ {applied.coupon.code} applied — {applied.coupon.label}
        </span>
        <button
          type="button"
          onClick={handleRemove}
          className="text-[12px] leading-none text-[#5E4A44] underline transition-colors hover:text-maroon-700"
        >
          Remove
        </button>
      </div>
    );
  }

  // A stored code that no longer validates (e.g. now below its minimum).
  const staleMessage = couponCode && applied && !applied.ok ? applied.message : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2.5">
        <label htmlFor="coupon" className="sr-only">
          Coupon code
        </label>
        <input
          id="coupon"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleApply();
            }
          }}
          placeholder="Coupon code (try BRIDE20)"
          className="min-w-0 flex-1 rounded-sm border border-[#E7D9C2] bg-white px-3 py-2.5 text-[13px] text-maroon-900 outline-none focus:border-gold-400 placeholder:text-[#B79B7E]"
        />
        <button
          type="button"
          onClick={handleApply}
          className="rounded-sm bg-maroon-700 px-[18px] text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-cream-200 transition-colors hover:bg-maroon-900"
        >
          Apply
        </button>
      </div>
      {(error || staleMessage) && (
        <p className="m-0 flex items-center justify-between gap-2 text-[12px] leading-snug text-[#B23A48]">
          <span>{error ?? staleMessage}</span>
          {staleMessage && !error && (
            <button
              type="button"
              onClick={handleRemove}
              className="whitespace-nowrap underline"
            >
              Remove
            </button>
          )}
        </p>
      )}
    </div>
  );
}

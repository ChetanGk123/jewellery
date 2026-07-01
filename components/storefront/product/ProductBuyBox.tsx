"use client";

import { useState } from "react";
import type { ProductOption } from "@/lib/db/queries";

const MIN_QTY = 1;
const MAX_QTY = 10;

/**
 * Purchase controls for the product detail page: plating-tone selector, a
 * quantity stepper, and the Add to Cart / WhatsApp actions. Matched to the
 * storefront prototype. The actions are stubs until the cart store (Phase 2)
 * and WhatsApp enquiry (Phase 2.7) land — mirrors the `Add` stub on ProductCard.
 */
export function ProductBuyBox({
  productName,
  options,
}: {
  productName: string;
  options: ProductOption[];
}) {
  const [tone, setTone] = useState(options[0]?.value ?? "");
  const [qty, setQty] = useState(MIN_QTY);

  const decrease = () => setQty((q) => Math.max(MIN_QTY, q - 1));
  const increase = () => setQty((q) => Math.min(MAX_QTY, q + 1));

  return (
    <div className="flex flex-col gap-[18px]">
      {options.length > 0 && (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="text-[12px] font-semibold uppercase leading-none tracking-[0.12em] text-maroon-900">
            Plating
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {options.map((option) => {
              const isSelected = option.value === tone;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setTone(option.value)}
                  className={`rounded-sm border px-[18px] py-2.5 text-[13px] font-medium leading-none transition-colors ${
                    isSelected
                      ? "border-maroon-700 bg-maroon-700 text-cream-200"
                      : "border-[#E7D9C2] bg-white text-maroon-900 hover:border-gold-400"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-4">
        <div className="flex items-center rounded-sm border border-[#E7D9C2] bg-white">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={decrease}
            disabled={qty <= MIN_QTY}
            className="h-[46px] w-[42px] text-[20px] text-maroon-700 disabled:opacity-40"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="w-10 text-center text-[15px] font-medium leading-none"
          >
            {qty}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={increase}
            disabled={qty >= MAX_QTY}
            className="h-[46px] w-[42px] text-[20px] text-maroon-700 disabled:opacity-40"
          >
            +
          </button>
        </div>

        <button
          type="button"
          aria-label={`Add ${productName} to cart`}
          className="min-w-[200px] flex-1 rounded-sm border-none bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-[30px] py-4 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#3A0E18] shadow-[0_10px_24px_rgba(168,122,30,0.28)] transition-[filter] hover:brightness-105"
        >
          Add to Cart
        </button>
      </div>

      <button
        type="button"
        className="flex items-center justify-center gap-2.5 rounded-sm border border-[#2EA84F] bg-white px-6 py-3.5 text-[13px] font-semibold leading-none text-[#1E7A38] transition-colors hover:bg-[#F2FBF4]"
      >
        <span className="text-[16px]" aria-hidden>
          💬
        </span>
        Enquire on WhatsApp
      </button>
    </div>
  );
}

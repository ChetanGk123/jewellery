"use client"

import Image from "next/image"
import { MAX_LINE_QUANTITY, type CartLine } from "@/lib/cart"
import { formatPaise } from "@/lib/utils/money"
import { PLACEHOLDER_GRADIENT } from "@/lib/theme"

type Props = {
  line: CartLine
  onDecrement: (line: CartLine) => void
  onIncrement: (line: CartLine) => void
  onRemove: (line: CartLine) => void
}

/**
 * A single cart line, matched to the storefront prototype's cart row: thumbnail
 * (real photo, else the seed gradient + engraved motif), name + chosen variant +
 * unit price, a quantity stepper, the line total, and a Remove link.
 */
export function CartLineRow({ line, onDecrement, onIncrement, onRemove }: Props) {
  const background = line.imageBg ?? PLACEHOLDER_GRADIENT
  const lineTotalPaise = line.pricePaise * line.quantity

  return (
    <li className="flex items-center gap-[18px] border-b border-[#EFE3D0] py-5">
      <div
        className="relative flex h-[92px] w-[92px] flex-none items-center justify-center overflow-hidden rounded-[3px] border border-[#EFE3D0]"
        style={{ background }}
      >
        {line.imageUrl ? (
          <Image src={line.imageUrl} alt={line.name} fill sizes="92px" className="object-cover" />
        ) : (
          <CartMotif />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-[5px]">
        <span className="font-heading text-[19px] font-semibold leading-[1.2] text-maroon-900">
          {line.name}
        </span>
        {line.optionValue && (
          <span className="text-[12px] leading-none text-[#9C8A84]">
            {line.optionLabel ? `${line.optionLabel}: ` : ""}
            {line.optionValue}
          </span>
        )}
        <span className="mt-[3px] text-[14px] font-medium leading-none text-maroon-700">
          {formatPaise(line.pricePaise)}
        </span>
      </div>

      <div className="flex flex-col items-end gap-2.5">
        <div className="flex items-center rounded-sm border border-[#E7D9C2] bg-white">
          <button
            type="button"
            aria-label={`Decrease quantity of ${line.name}`}
            onClick={() => onDecrement(line)}
            className="h-9 w-[34px] text-[17px] text-maroon-700"
          >
            −
          </button>
          <span aria-live="polite" className="w-8 text-center text-[14px] font-medium leading-none">
            {line.quantity}
          </span>
          <button
            type="button"
            aria-label={`Increase quantity of ${line.name}`}
            onClick={() => onIncrement(line)}
            disabled={line.quantity >= MAX_LINE_QUANTITY}
            className="h-9 w-[34px] text-[17px] text-maroon-700 disabled:opacity-40"
          >
            +
          </button>
        </div>
        <span className="text-[15px] font-semibold leading-none text-maroon-900">
          {formatPaise(lineTotalPaise)}
        </span>
        <button
          type="button"
          onClick={() => onRemove(line)}
          className="text-[12px] leading-none text-[#A6938C] underline transition-colors hover:text-maroon-700"
        >
          Remove
        </button>
      </div>
    </li>
  )
}

/** Engraved ring placeholder shown on a line with no real photo. */
function CartMotif() {
  return (
    <svg
      viewBox="0 0 120 120"
      width="40"
      height="40"
      fill="none"
      stroke="#A88A55"
      strokeWidth="1.6"
      className="opacity-55"
      aria-hidden
    >
      <circle cx="60" cy="60" r="40" />
      <circle cx="60" cy="60" r="4" fill="#A88A55" stroke="none" />
    </svg>
  )
}

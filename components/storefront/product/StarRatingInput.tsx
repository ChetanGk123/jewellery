"use client"

import { useState } from "react"

type Props = {
  value: number
  onChange: (value: number) => void
}

/**
 * Clickable 1–5 star picker for the review form (TASKS 4.15) — a write
 * counterpart to the read-only `StarRating` display. Hover previews the
 * value; click commits it.
 */
export function StarRatingInput({ value, onChange }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  const shown = hovered ?? value

  return (
    <div
      role="radiogroup"
      aria-label="Rating"
      className="flex items-center gap-1.5"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onMouseEnter={() => setHovered(star)}
          onClick={() => onChange(star)}
          className={`text-[26px] leading-none transition-colors ${
            star <= shown ? "text-gold-400" : "text-[#E0CFB4]"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

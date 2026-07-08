"use client"

import { useEffect, useRef, useState } from "react"

const DEBOUNCE_MS = 350

/**
 * Shared debounced list search (replaces the Search/Clear buttons on every
 * admin table). Typing filters as you go: ~350ms after the last keystroke the
 * trimmed term is pushed to the caller, which folds it into the list URL —
 * search stays URL-driven (shareable, survives refresh), only the trigger
 * changed. Clearing the input (native ✕ / backspace) fires with "" to reset.
 */
export function AdminSearchBox({
  value,
  onSearch,
  placeholder,
  ariaLabel,
  className,
}: {
  /** The search currently applied on the server (seeded from the URL). */
  value: string
  /** Debounce-fired with the trimmed term — use router.replace, not push. */
  onSearch: (term: string) => void
  placeholder: string
  ariaLabel: string
  className?: string
}) {
  const [query, setQuery] = useState(value)
  // Ref so an inline callback prop doesn't retrigger the debounce effect.
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  useEffect(() => {
    const term = query.trim()
    // Already what the server shows (incl. on mount) — nothing to do.
    if (term === value) return
    const id = setTimeout(() => onSearchRef.current(term), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query, value])

  return (
    <div
      className={`flex items-center rounded-lg border border-[#E7E0D4] bg-white px-3 ${className ?? ""}`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9C8A7E"
        strokeWidth={2}
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3-3" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="w-full flex-1 border-none bg-transparent px-2 py-[9px] text-[13px] text-[#2A1F1A] outline-none placeholder:text-[#9C8A7E]"
      />
    </div>
  )
}

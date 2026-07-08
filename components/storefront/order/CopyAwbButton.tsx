"use client"

import { useState } from "react"

/**
 * One-tap copy for the courier AWB on the customer's order page (6.4
 * follow-up) — tracking numbers are fiddly to select on a phone. Falls back
 * silently when the Clipboard API is unavailable (the number stays selectable
 * text either way).
 */
export function CopyAwbButton({ awb }: { awb: string }) {
  const [isCopied, setIsCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(awb)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      // Clipboard blocked (permissions / non-secure context) — no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-sm border border-[#E7D9C2] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-maroon-700 transition-colors hover:border-gold-600"
    >
      {isCopied ? "Copied ✓" : "Copy"}
    </button>
  )
}

"use client"

import { useEffect } from "react"
import "./globals.css"

/**
 * Last-resort error boundary (Phase 4.3) — only fires if the ROOT layout
 * itself throws, so it must render its own <html>/<body> per the Next.js
 * `global-error.tsx` convention (it fully replaces `app/layout.tsx` in that
 * case). Kept intentionally simple/self-contained — no next/font variables,
 * no Header/Footer — since this is the catastrophic fallback path.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-[18px] bg-cream-100 px-6 text-center">
        <span
          aria-hidden="true"
          className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] text-[38px] leading-none text-[#3A0E18] shadow-[0_14px_30px_rgba(168,122,30,0.3)]"
        >
          !
        </span>
        <h1 className="m-0 font-heading text-[32px] font-semibold leading-[1.15] text-maroon-900">
          Something went wrong
        </h1>
        <p className="m-0 max-w-[420px] text-[15px] font-light leading-[1.6] text-[#5E4A44]">
          The page failed to load. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-2 rounded-sm bg-maroon-700 px-[30px] py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#F3E3C7] transition-colors hover:bg-maroon-900"
        >
          Try Again
        </button>
      </body>
    </html>
  )
}

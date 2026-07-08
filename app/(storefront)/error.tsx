"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ROUTES } from "@/lib/routes"

/**
 * Branded runtime-error boundary for the storefront (Phase 4.3) — replaces
 * Next's unstyled default fallback. Must be a Client Component per the
 * `error.tsx` convention (receives `error`/`reset` from the framework).
 */
export default function StorefrontError({
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
    <main className="mx-auto flex max-w-[560px] flex-1 flex-col items-center justify-center gap-[18px] px-6 py-[90px] text-center">
      <span
        aria-hidden="true"
        className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] text-[38px] leading-none text-[#3A0E18] shadow-[0_14px_30px_rgba(168,122,30,0.3)]"
      >
        !
      </span>

      <h1 className="m-0 font-heading text-[36px] font-semibold leading-[1.15] text-maroon-900">
        Something went wrong
      </h1>

      <p className="m-0 max-w-[420px] text-[15px] font-light leading-[1.6] text-[#5E4A44]">
        We hit a snag loading this page. Please try again, or head back to the shop — your cart is
        safe either way.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-sm bg-maroon-700 px-[30px] py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#F3E3C7] transition-colors hover:bg-maroon-900"
        >
          Try Again
        </button>
        <Link
          href={ROUTES.home}
          className="rounded-sm border border-[#E7D9C2] px-[30px] py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-maroon-900 transition-colors hover:bg-cream-100"
        >
          Back to Home
        </Link>
      </div>
    </main>
  )
}

import Link from "next/link"
import { ROUTES } from "@/lib/routes"
import { STORE_INFO } from "@/lib/store-info"

/**
 * Root-level 404 (Phase 4.3) — catches genuinely unmatched top-level paths
 * that never reach the `(storefront)` or `(admin)` route groups, so their
 * Header/Footer chrome isn't available here. Self-contained, brand-styled
 * fallback instead of Next's unstyled default.
 */
export default function RootNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-[18px] bg-cream-100 px-6 py-[90px] text-center">
      <span className="font-display text-[15px] tracking-[0.14em] text-maroon-700">
        {STORE_INFO.wordmark}
      </span>
      <span
        aria-hidden="true"
        className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] font-heading text-[30px] font-semibold leading-none text-[#3A0E18] shadow-[0_14px_30px_rgba(168,122,30,0.3)]"
      >
        404
      </span>
      <h1 className="m-0 font-heading text-[36px] font-semibold leading-[1.15] text-maroon-900">
        Page not found
      </h1>
      <p className="m-0 max-w-[420px] text-[15px] font-light leading-[1.6] text-[#5E4A44]">
        The page you&apos;re looking for doesn&apos;t exist. Let&apos;s get you back on track.
      </p>
      <Link
        href={ROUTES.home}
        className="mt-2 rounded-sm bg-maroon-700 px-[30px] py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#F3E3C7] transition-colors hover:bg-maroon-900"
      >
        Back to Home
      </Link>
    </main>
  )
}

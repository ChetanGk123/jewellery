import Link from "next/link"
import { ROUTES } from "@/lib/routes"

/**
 * Branded 404 for the storefront (Phase 4.3) — replaces Next's unstyled
 * default fallback, which rendered as a jarring black panel inside the
 * cream chrome (flagged in STOREFRONT_SHORTFALLS.md). Renders inside the
 * `(storefront)` layout, so the Header/Footer still wrap it.
 */
export default function StorefrontNotFound() {
  return (
    <main className="mx-auto flex max-w-[560px] flex-1 flex-col items-center justify-center gap-[18px] px-6 py-[90px] text-center">
      <span
        aria-hidden="true"
        className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] font-heading text-[30px] font-semibold leading-none text-[#3A0E18] shadow-[0_14px_30px_rgba(168,122,30,0.3)]"
      >
        404
      </span>

      <h1 className="m-0 font-heading text-[36px] font-semibold leading-[1.15] text-maroon-900">
        We couldn&apos;t find that page
      </h1>

      <p className="m-0 max-w-[420px] text-[15px] font-light leading-[1.6] text-[#5E4A44]">
        The page you&apos;re looking for may have moved, or the link isn&apos;t quite right.
        Let&apos;s get you back to the collection.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={ROUTES.shop}
          className="rounded-sm bg-maroon-700 px-[30px] py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#F3E3C7] transition-colors hover:bg-maroon-900"
        >
          Shop All Jewellery
        </Link>
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

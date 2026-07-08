import Link from "next/link"
import { ROUTES } from "@/lib/routes"

/**
 * Closing editorial section — matched to the prototype: a centred gold divider,
 * an italic serif pull-quote, a short brand paragraph, and a maroon CTA.
 */
export function StoryBlock() {
  return (
    <section className="mt-[62px] border-y border-[#EFE3D0] bg-cream-50">
      <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-[18px] px-6 py-16 text-center">
        <svg
          viewBox="0 0 120 30"
          width="120"
          height="30"
          fill="none"
          stroke="#C9A24B"
          strokeWidth="1"
          aria-hidden
        >
          <line x1="0" y1="15" x2="46" y2="15" />
          <line x1="74" y1="15" x2="120" y2="15" />
          <path d="M60 6 L64 15 L60 24 L56 15 Z" fill="#C9A24B" stroke="none" />
        </svg>
        <h2 className="m-0 max-w-[760px] text-balance font-heading text-[34px] font-medium italic leading-[1.3] text-maroon-900">
          “The heirloom look, without the heirloom price — jewellery made to shine on your biggest
          days.”
        </h2>
        <p className="m-0 max-w-[620px] text-[14px] font-normal leading-[1.7] text-[#7A655F]">
          Every JR piece is finished by hand, plated to last, and kind to sensitive skin. From the
          mandap to the mehendi, find your full bridal look in one place.
        </p>
        <Link
          href={ROUTES.shop}
          className="mt-2 rounded-sm bg-maroon-700 px-8 py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-cream-200 transition-colors hover:bg-maroon-800"
        >
          Discover the Collection
        </Link>
      </div>
    </section>
  )
}

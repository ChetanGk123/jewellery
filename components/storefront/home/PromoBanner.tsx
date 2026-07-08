import Link from "next/link"
import type { PromoSetting } from "@/lib/db/settings"
import { ROUTES } from "@/lib/routes"

/**
 * Home offer banner, driven by `setting.homepage_promo`. Renders nothing when
 * the promo is disabled or has no title. Matched to the prototype: maroon
 * gradient card, concentric gold rings, eyebrow/title/note (with optional
 * highlighted code) and a gold CTA that routes to the shop.
 */
export function PromoBanner({ promo }: { promo: PromoSetting }) {
  if (!promo.enabled || !promo.title) return null

  return (
    <section className="mx-auto mt-[62px] max-w-[1280px] px-6">
      <div className="relative flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-md bg-[linear-gradient(115deg,#5E1322,#71182B_60%,#4A0E1C)] px-11 py-[54px]">
        <div
          className="absolute -right-10 -top-10 h-[220px] w-[220px] rounded-full border border-gold-300/25"
          aria-hidden
        />
        <div
          className="absolute -bottom-[70px] right-2.5 h-40 w-40 rounded-full border border-gold-300/20"
          aria-hidden
        />

        <div className="relative flex flex-col gap-3">
          <span className="text-[12px] font-medium uppercase leading-none tracking-[0.3em] text-gold-300">
            {promo.eyebrow}
          </span>
          <h2 className="m-0 font-heading text-[clamp(32px,5vw,52px)] font-semibold leading-none text-[#FBF1DE]">
            {promo.title}
          </h2>
          <p className="m-0 text-[15px] font-light leading-[1.6] text-[#E8CFC0]">
            {promo.code && (
              <>
                Use code{" "}
                <span className="font-semibold tracking-[0.06em] text-gold-300">
                  {promo.code}
                </span>{" "}
              </>
            )}
            {promo.note}
          </p>
        </div>

        <Link
          href={ROUTES.shop}
          className="relative inline-flex items-center rounded-sm bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-[34px] py-4 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#3A0E18] shadow-[0_12px_28px_rgba(0,0,0,0.28)] transition-transform duration-200 hover:-translate-y-0.5"
        >
          {promo.button}
        </Link>
      </div>
    </section>
  )
}

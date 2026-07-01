import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/**
 * Home hero — matched to the storefront prototype: a deep-maroon gradient panel
 * with the "Bridal Edit" eyebrow, a serif headline (gold italic accent), two
 * CTAs, and a framed "your photo here" placeholder card on the right.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(120deg,#4A0E1C,#71182B_55%,#5E1322)]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-12 px-6 py-16">
        <div className="flex min-w-[300px] flex-1 flex-col gap-[22px]">
          <span className="text-[12px] font-medium uppercase leading-none tracking-[0.34em] text-gold-300">
            The Bridal Edit · 2026
          </span>
          <h1 className="m-0 text-balance font-heading text-[clamp(40px,6vw,68px)] font-semibold leading-[1.04] text-[#FBF1DE]">
            Adorn every
            <br />
            celebration in
            <span className="italic text-gold-300"> radiant gold.</span>
          </h1>
          <p className="m-0 max-w-[440px] text-[16px] font-light leading-[1.7] text-[#E8CFC0]">
            Kundan, polki and temple-inspired bridal jewellery — the heirloom
            look, crafted to be light, affordable and skin-friendly.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-3.5">
            <Link
              href={ROUTES.category("bridal-sets")}
              className="inline-flex items-center justify-center rounded-sm bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-8 py-[15px] text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#3A0E18] shadow-[0_10px_26px_rgba(168,122,30,0.3)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              Shop Bridal Sets
            </Link>
            <Link
              href={ROUTES.shop}
              className="inline-flex items-center justify-center rounded-sm border border-gold-300/55 px-8 py-[15px] text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-cream-200 transition-colors duration-200 hover:border-gold-300 hover:bg-white/5"
            >
              View All Jewellery
            </Link>
          </div>
        </div>

        <div className="relative flex aspect-[4/5] w-[340px] max-w-full flex-col items-center justify-center rounded-md bg-[linear-gradient(150deg,#F3EEE0,#E3D6BA_55%,#D2BE90)] shadow-[0_30px_60px_rgba(0,0,0,0.3)]">
          <div className="absolute inset-3.5 border border-gold-600/40" aria-hidden />
          <svg
            viewBox="0 0 120 120"
            width="104"
            height="104"
            fill="none"
            stroke="#9C7526"
            strokeWidth="1.2"
            className="opacity-85"
            aria-hidden
          >
            <circle cx="60" cy="60" r="44" />
            <circle cx="60" cy="60" r="32" className="opacity-50" />
            <path d="M60 24 L66 54 L60 60 L54 54 Z" fill="#9C7526" stroke="none" />
            <path d="M60 96 L66 66 L60 60 L54 66 Z" fill="#9C7526" stroke="none" />
            <path d="M24 60 L54 54 L60 60 L54 66 Z" fill="#9C7526" stroke="none" />
            <path d="M96 60 L66 54 L60 60 L66 66 Z" fill="#9C7526" stroke="none" />
            <circle cx="60" cy="60" r="3.6" fill="#9C7526" stroke="none" />
          </svg>
          <div className="mt-[18px] font-display text-[13px] leading-none tracking-[0.34em] text-[#8A6620]">
            JR JEWELLERS
          </div>
          <div className="mt-[9px] text-[11px] uppercase leading-none tracking-[0.12em] text-[#A88A55]">
            Your photo here
          </div>
        </div>
      </div>
    </section>
  );
}

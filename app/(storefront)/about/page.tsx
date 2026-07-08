import type { Metadata } from "next"
import Link from "next/link"
import { HelpHeader } from "@/components/storefront/help/HelpHeader"
import { HelpSection, IconCard } from "@/components/storefront/help/HelpBlocks"
import { ABOUT_INTRO, ABOUT_VALUES } from "@/lib/help-content"
import { ROUTES } from "@/lib/routes"

export const metadata: Metadata = {
  title: "About Us",
  description:
    "RJ Jewellers crafts artificial bridal jewellery from Jaipur — heritage Kundan, Polki and temple artistry reimagined for the modern celebration, at honest value.",
}

/**
 * About Us (TASKS 1.7) — no prototype equivalent, authored to the brand voice
 * using the shared help-page visual language: maroon hero, an intro, our
 * values, and a shop CTA.
 */
export default function AboutPage() {
  return (
    <main>
      <HelpHeader
        crumb="About Us"
        eyebrow="Our story"
        title="About RJ Jewellers"
        intro="Heritage bridal artistry, reimagined for the modern celebration — crafted in Jaipur, worn nationwide."
      />

      <div className="mx-auto flex max-w-[1000px] flex-col gap-[42px] px-6 pb-16 pt-[54px]">
        <p className="m-0 max-w-[760px] text-[16px] font-light leading-[1.8] text-[#5E4A44]">
          {ABOUT_INTRO}
        </p>

        <HelpSection title="What we stand for">
          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
            {ABOUT_VALUES.map((value) => (
              <IconCard key={value.title} {...value} />
            ))}
          </div>
        </HelpSection>

        <div className="flex flex-wrap items-center justify-between gap-[18px] rounded-md bg-[linear-gradient(115deg,#5E1322,#71182B_60%,#4A0E1C)] px-[30px] py-[34px]">
          <div className="flex flex-col gap-1.5">
            <div className="font-heading text-[22px] font-semibold leading-[1.2] text-[#FBF1DE]">
              Find your bridal look
            </div>
            <p className="m-0 text-[13.5px] font-light leading-[1.5] text-[#E8CFC0]">
              From mandap sets to everyday jhumkas — explore the full collection.
            </p>
          </div>
          <Link
            href={ROUTES.shop}
            className="rounded-sm bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-[30px] py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.12em] text-[#3A0E18] transition-[filter] hover:brightness-105"
          >
            Shop All Jewellery
          </Link>
        </div>
      </div>
    </main>
  )
}

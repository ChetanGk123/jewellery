import type { Metadata } from "next"
import Link from "next/link"
import { HelpHeader } from "@/components/storefront/help/HelpHeader"
import {
  CheckList,
  HelpSection,
  IconCard,
  NumberedSteps,
  RatesTable,
} from "@/components/storefront/help/HelpBlocks"
import { RETURN_NO, RETURN_STEPS, RETURN_YES, SHIP_CARDS, SHIP_RATES } from "@/lib/help-content"
import { ROUTES } from "@/lib/routes"

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description:
    "How your RJ Jewellers order reaches you — dispatch times, delivery windows, COD, shipping rates, and our 7-day returns & exchange policy.",
}

/**
 * Shipping & Returns (TASKS 1.7) — prototype-matched help page: delivery cards,
 * a shipping-rate table, the returns process, and eligibility lists.
 */
export default function ShippingPage() {
  return (
    <main>
      <HelpHeader
        crumb="Shipping & Returns"
        eyebrow="Help Centre"
        title="Shipping & Returns"
        intro="Everything about how your order reaches you — and how to send it back if it isn't quite right."
      />

      <div className="mx-auto flex max-w-[1000px] flex-col gap-10 px-6 pb-16 pt-[54px]">
        <HelpSection title="Delivery">
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
            {SHIP_CARDS.map((card) => (
              <IconCard key={card.title} {...card} />
            ))}
          </div>
        </HelpSection>

        <RatesTable rows={SHIP_RATES} />

        <HelpSection title="Returns & Exchanges">
          <p className="m-0 mb-5 max-w-[680px] text-[15px] font-light leading-[1.7] text-[#5E4A44]">
            Changed your mind? You have{" "}
            <strong className="font-semibold text-maroon-900">7 days</strong> from delivery to
            request a return or exchange on unworn items in their original packaging with tags
            intact.
          </p>
          <NumberedSteps steps={RETURN_STEPS} />
          <div className="mt-[18px] grid grid-cols-1 gap-[18px] md:grid-cols-2">
            <CheckList tone="yes" title="Eligible for return" items={RETURN_YES} />
            <CheckList tone="no" title="Not returnable" items={RETURN_NO} />
          </div>
        </HelpSection>

        <div className="flex flex-wrap items-center justify-between gap-[18px] rounded-md bg-[linear-gradient(115deg,#5E1322,#71182B_60%,#4A0E1C)] px-[30px] py-[34px]">
          <div className="flex flex-col gap-1.5">
            <div className="font-heading text-[22px] font-semibold leading-[1.2] text-[#FBF1DE]">
              Need to start a return?
            </div>
            <p className="m-0 text-[13.5px] font-light leading-[1.5] text-[#E8CFC0]">
              Our team will arrange a pickup — message us on WhatsApp with your order number.
            </p>
          </div>
          <Link
            href={ROUTES.contact}
            className="rounded-sm bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-[30px] py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.12em] text-[#3A0E18] transition-[filter] hover:brightness-105"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </main>
  )
}

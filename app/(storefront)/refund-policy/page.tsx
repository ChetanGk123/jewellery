import type { Metadata } from "next"
import Link from "next/link"
import { HelpHeader } from "@/components/storefront/help/HelpHeader"
import { LegalSection, LegalUpdatedNote } from "@/components/storefront/help/LegalBlocks"
import { getStoreInfo } from "@/lib/db/settings"
import { REFUND_SECTIONS } from "@/lib/legal-content"
import { ROUTES } from "@/lib/routes"

export async function generateMetadata(): Promise<Metadata> {
  const info = await getStoreInfo()
  return {
    title: "Cancellation & Refund Policy",
    description: `How to cancel an order, request a return or exchange, and how refunds are processed at ${info.name}.`,
  }
}

/**
 * Cancellation & Refund Policy (Phase 4.2) — the formal counterpart to the
 * friendly Shipping & Returns page; authored to close the compliance gap
 * flagged in STOREFRONT_SHORTFALLS.md (India's Consumer Protection
 * (E-Commerce) Rules, 2020 require a published cancellation/refund policy).
 * Contact details come from the Settings-editable resolved info (6.15).
 */
export default async function RefundPolicyPage() {
  const info = await getStoreInfo()

  return (
    <main>
      <HelpHeader
        crumb="Cancellation & Refund Policy"
        eyebrow="Legal"
        title="Cancellation & Refund Policy"
        intro="How to cancel an order, request a return or exchange, and how refunds are processed."
      />

      <div className="mx-auto flex max-w-[760px] flex-col gap-8 px-6 pb-16 pt-[54px]">
        <LegalUpdatedNote />

        <p className="m-0 text-[13.5px] font-light leading-[1.7] text-[#5E4A44]">
          This is the formal policy referenced in our Terms of Use. For a more visual walkthrough of
          delivery and returns, see{" "}
          <Link href={ROUTES.shipping} className="text-maroon-700 underline hover:text-maroon-900">
            Shipping &amp; Returns
          </Link>
          .
        </p>

        {REFUND_SECTIONS.map((section) => (
          <LegalSection key={section.heading} {...section} />
        ))}

        <LegalSection
          heading="Contact for returns"
          paragraphs={[
            `Message us on WhatsApp, call ${info.phone.display}, or email ${info.email.display} to start a cancellation or return.`,
          ]}
        />
      </div>
    </main>
  )
}

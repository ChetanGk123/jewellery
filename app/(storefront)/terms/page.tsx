import type { Metadata } from "next"
import { HelpHeader } from "@/components/storefront/help/HelpHeader"
import { LegalSection, LegalUpdatedNote } from "@/components/storefront/help/LegalBlocks"
import { TERMS_SECTIONS } from "@/lib/legal-content"
import { STORE_INFO } from "@/lib/store-info"

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms that govern your use of the RJ Jewellers website and your purchase of products through it.",
}

/**
 * Terms of Use (Phase 4.2) — no prototype equivalent; authored to close the
 * compliance gap flagged in STOREFRONT_SHORTFALLS.md.
 */
export default function TermsPage() {
  return (
    <main>
      <HelpHeader
        crumb="Terms of Use"
        eyebrow="Legal"
        title="Terms of Use"
        intro="The terms that apply when you browse this site or place an order."
      />

      <div className="mx-auto flex max-w-[760px] flex-col gap-8 px-6 pb-16 pt-[54px]">
        <LegalUpdatedNote />

        {TERMS_SECTIONS.map((section) => (
          <LegalSection key={section.heading} {...section} />
        ))}

        <LegalSection
          heading="Grievance officer"
          paragraphs={[
            `For any complaint or grievance regarding your order or this site, contact our support team at ${STORE_INFO.email.display} or ${STORE_INFO.phone.display} (${STORE_INFO.hours.short}). We aim to acknowledge every complaint within 48 hours.`,
          ]}
        />
      </div>
    </main>
  )
}

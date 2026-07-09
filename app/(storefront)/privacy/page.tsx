import type { Metadata } from "next"
import { HelpHeader } from "@/components/storefront/help/HelpHeader"
import { LegalSection, LegalUpdatedNote } from "@/components/storefront/help/LegalBlocks"
import { getStoreInfo } from "@/lib/db/settings"
import { privacySections } from "@/lib/legal-content"

export async function generateMetadata(): Promise<Metadata> {
  const info = await getStoreInfo()
  return {
    title: "Privacy Policy",
    description: `How ${info.name} collects, uses, and protects your personal information when you shop with us.`,
  }
}

/**
 * Privacy Policy (Phase 4.2) — no prototype equivalent; authored to close the
 * compliance gap flagged in STOREFRONT_SHORTFALLS.md. Reuses the help-page
 * hero and the legal-specific prose primitives. Store identity/contact comes
 * from the Settings-editable resolved info (6.15).
 */
export default async function PrivacyPage() {
  const info = await getStoreInfo()

  return (
    <main>
      <HelpHeader
        crumb="Privacy Policy"
        eyebrow="Legal"
        title="Privacy Policy"
        intro="What we collect, why we collect it, and the choices you have."
      />

      <div className="mx-auto flex max-w-[760px] flex-col gap-8 px-6 pb-16 pt-[54px]">
        <LegalUpdatedNote />

        {privacySections(info).map((section) => (
          <LegalSection key={section.heading} {...section} />
        ))}

        <LegalSection
          heading="Contact us"
          paragraphs={[
            `Questions about this policy or your data can be sent to ${info.email.display} or ${info.phone.display}.`,
          ]}
        />
      </div>
    </main>
  )
}

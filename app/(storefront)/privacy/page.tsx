import type { Metadata } from "next";
import { HelpHeader } from "@/components/storefront/help/HelpHeader";
import { LegalSection, LegalUpdatedNote } from "@/components/storefront/help/LegalBlocks";
import { PRIVACY_SECTIONS } from "@/lib/legal-content";
import { STORE_INFO } from "@/lib/store-info";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How RJ Jewellers collects, uses, and protects your personal information when you shop with us.",
};

/**
 * Privacy Policy (Phase 4.2) — no prototype equivalent; authored to close the
 * compliance gap flagged in STOREFRONT_SHORTFALLS.md. Reuses the help-page
 * hero and the legal-specific prose primitives.
 */
export default function PrivacyPage() {
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

        {PRIVACY_SECTIONS.map((section) => (
          <LegalSection key={section.heading} {...section} />
        ))}

        <LegalSection
          heading="Contact us"
          paragraphs={[
            `Questions about this policy or your data can be sent to ${STORE_INFO.email.display} or ${STORE_INFO.phone.display}.`,
          ]}
        />
      </div>
    </main>
  );
}

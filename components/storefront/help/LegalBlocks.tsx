import type { LegalSectionData } from "@/lib/legal-content"
import { LEGAL_LAST_UPDATED } from "@/lib/legal-content"

/**
 * Presentational primitives for the legal pages (Privacy, Terms, Refund
 * Policy — Phase 4.2). Denser than `HelpBlocks`' icon-card sections, since
 * legal copy is a sequence of numbered-clause-style prose rather than
 * marketing cards.
 */

/** "Last updated {date}" caption shown under the page hero. */
export function LegalUpdatedNote() {
  return (
    <p className="m-0 text-[12.5px] font-light leading-none text-[#9C8A84]">
      Last updated: {LEGAL_LAST_UPDATED}
    </p>
  )
}

/** One numbered-clause section: compact heading, paragraphs, optional list. */
export function LegalSection({ heading, paragraphs, list }: LegalSectionData) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 font-heading text-[20px] font-semibold leading-[1.25] text-maroon-900">
        {heading}
      </h2>
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="m-0 text-[14.5px] font-light leading-[1.75] text-[#5E4A44]">
          {paragraph}
        </p>
      ))}
      {list &&
        (list.ordered ? (
          <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-[14.5px] font-light leading-[1.7] text-[#5E4A44]">
            {list.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        ) : (
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-[14.5px] font-light leading-[1.7] text-[#5E4A44]">
            {list.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ))}
    </section>
  )
}

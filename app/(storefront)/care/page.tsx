import type { Metadata } from "next";
import { HelpHeader } from "@/components/storefront/help/HelpHeader";
import {
  CheckList,
  HelpSection,
  IconCard,
  NumberCard,
} from "@/components/storefront/help/HelpBlocks";
import {
  CARE_DO,
  CARE_DONT,
  CARE_HOW,
  CARE_RULES,
} from "@/lib/help-content";

export const metadata: Metadata = {
  title: "Jewellery Care Guide",
  description:
    "Keep your RJ Jewellers pieces bright and sparkling — the four golden rules, do's and don'ts, plus cleaning and storage tips for anti-tarnish artificial jewellery.",
};

/**
 * Care Guide (TASKS 1.7) — prototype-matched: the four golden rules, a do/don't
 * split, cleaning + storage cards, and a closing anti-tarnish note.
 */
export default function CarePage() {
  return (
    <main>
      <HelpHeader
        crumb="Care Guide"
        eyebrow="Make it last"
        title="Jewellery Care Guide"
        intro="A little care keeps the plating bright and the stones sparkling, function after function."
      />

      <div className="mx-auto flex max-w-[1000px] flex-col gap-[42px] px-6 pb-16 pt-[54px]">
        <HelpSection title="The Four Golden Rules">
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
            {CARE_RULES.map((rule) => (
              <NumberCard key={rule.n} {...rule} />
            ))}
          </div>
        </HelpSection>

        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
          <CheckList tone="yes" title="Do" items={CARE_DO} />
          <CheckList tone="no" title="Don't" items={CARE_DONT} />
        </div>

        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
          {CARE_HOW.map((card) => (
            <IconCard key={card.title} {...card} />
          ))}
        </div>

        <div className="flex flex-col items-center gap-2.5 rounded-md border border-dashed border-[#E0CFB4] bg-cream-50 px-6 py-[34px] text-center">
          <svg
            viewBox="0 0 120 30"
            width="110"
            height="28"
            fill="none"
            stroke="#C9A24B"
            strokeWidth="1"
            aria-hidden
          >
            <line x1="0" y1="15" x2="46" y2="15" />
            <line x1="74" y1="15" x2="120" y2="15" />
            <path d="M60 6 L64 15 L60 24 L56 15 Z" fill="#C9A24B" stroke="none" />
          </svg>
          <p className="m-0 max-w-[560px] text-[15px] font-normal italic leading-[1.7] text-[#5E4A44]">
            Every JR piece carries an anti-tarnish plating. Treated with care,
            your jewellery will stay radiant through every celebration.
          </p>
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { HelpHeader } from "@/components/storefront/help/HelpHeader";
import { FAQ_ITEMS } from "@/lib/help-content";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers to common questions about RJ Jewellers — materials, delivery, Cash on Delivery, returns, plating care, and custom bridal sets.",
};

/**
 * FAQ (TASKS 1.7) — no prototype equivalent, authored to the brand voice using
 * the shared help-page visual language. Native <details>/<summary> disclosures
 * keep it accessible and keyboard-friendly without client JS.
 */
export default function FaqPage() {
  return (
    <main>
      <HelpHeader
        crumb="FAQ"
        eyebrow="Good to know"
        title="Frequently Asked Questions"
        intro="Everything brides ask us most — from materials and delivery to returns and custom sets."
      />

      <div className="mx-auto flex max-w-[820px] flex-col gap-3 px-6 pb-16 pt-[54px]">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.q}
            className="group rounded-md border border-[#E7D9C2] bg-cream-50 px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-heading text-[19px] font-semibold leading-[1.3] text-maroon-900">
              {item.q}
              <span
                className="flex-none text-[20px] font-light text-gold-600 transition-transform group-open:rotate-45"
                aria-hidden
              >
                +
              </span>
            </summary>
            <p className="m-0 mt-3 text-[14px] font-light leading-[1.7] text-[#5E4A44]">
              {item.a}
            </p>
          </details>
        ))}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-[18px] rounded-md bg-[linear-gradient(115deg,#5E1322,#71182B_60%,#4A0E1C)] px-[30px] py-[34px]">
          <div className="flex flex-col gap-1.5">
            <div className="font-heading text-[22px] font-semibold leading-[1.2] text-[#FBF1DE]">
              Still have a question?
            </div>
            <p className="m-0 text-[13.5px] font-light leading-[1.5] text-[#E8CFC0]">
              Our team is a message away — we usually reply within a few hours.
            </p>
          </div>
          <Link
            href={ROUTES.contact}
            className="rounded-sm bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-[30px] py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.12em] text-[#3A0E18] transition-[filter] hover:brightness-105"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </main>
  );
}

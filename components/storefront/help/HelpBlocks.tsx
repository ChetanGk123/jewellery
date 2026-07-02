import type { ReactNode } from "react";
import type { IconItem, NumberedItem, RateRow } from "@/lib/help-content";

/**
 * Presentational primitives shared across the help / info pages (Shipping,
 * Care, About). Kept together because they are small, cohesive, and only used
 * on these pages. All styling mirrors the storefront prototype's help sections.
 */

/** Section wrapper: serif heading + gold underline rule, then arbitrary body. */
export function HelpSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col">
      <h2 className="m-0 font-heading text-[30px] font-semibold leading-[1.1] text-maroon-900">
        {title}
      </h2>
      <div className="mb-[18px] mt-1.5 h-0.5 w-12 bg-gold-400" />
      {children}
    </section>
  );
}

/** Cream card with a symbol/icon, title, and body — ship cards, care "how". */
export function IconCard({ icon, title, body }: IconItem) {
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-[#EFE3D0] bg-cream-50 p-6">
      <span className="text-[22px] text-gold-400" aria-hidden>
        {icon}
      </span>
      <div className="font-heading text-[16px] font-semibold leading-[1.3] text-maroon-900">
        {title}
      </div>
      <p className="m-0 text-[13.5px] font-light leading-[1.6] text-[#5E4A44]">
        {body}
      </p>
    </div>
  );
}

/** Cream card led by a large serif number — the care guide's golden rules. */
export function NumberCard({ n, title, body }: NumberedItem) {
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-[#EFE3D0] bg-cream-50 p-6">
      <span className="font-heading text-[28px] font-semibold leading-none text-gold-400">
        {n}
      </span>
      <div className="font-heading text-[16px] font-semibold leading-[1.3] text-maroon-900">
        {title}
      </div>
      <p className="m-0 text-[13px] font-light leading-[1.6] text-[#5E4A44]">
        {body}
      </p>
    </div>
  );
}

/** Joined, numbered process strip — the returns "how it works" steps. */
export function NumberedSteps({ steps }: { steps: NumberedItem[] }) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-md border border-[#E7D9C2] bg-cream-50 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step) => (
        <div
          key={step.n}
          className="flex flex-col gap-2.5 border-[#EFE3D0] p-6 [&:not(:last-child)]:border-b lg:[&:not(:last-child)]:border-b-0 lg:[&:not(:last-child)]:border-r"
        >
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-maroon-700 text-center text-[14px] font-semibold text-cream-200">
            {step.n}
          </span>
          <div className="font-heading text-[15px] font-semibold leading-[1.3] text-maroon-900">
            {step.title}
          </div>
          <p className="m-0 text-[12.5px] font-light leading-[1.55] text-[#5E4A44]">
            {step.body}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Do / Don't (green) vs (rose) list card — care rules and return eligibility. */
export function CheckList({
  tone,
  title,
  items,
}: {
  tone: "yes" | "no";
  title: string;
  items: string[];
}) {
  const isYes = tone === "yes";
  const surface = isYes
    ? "border-[#CFE9D4] bg-[#F4FBF5]"
    : "border-[#F0D2D6] bg-[#FBF1F2]";
  const label = isYes ? "text-[#1E7A38]" : "text-[#B23A48]";
  const mark = isYes ? "✓" : "×";

  return (
    <div className={`flex flex-col gap-3.5 rounded-md border p-6 ${surface}`}>
      <div
        className={`text-[13px] font-semibold uppercase leading-none tracking-[0.12em] ${label}`}
      >
        {title}
      </div>
      {items.map((item) => (
        <div
          key={item}
          className="flex gap-2.5 text-[13.5px] font-light leading-[1.5] text-maroon-900"
        >
          <span aria-hidden className={label}>
            {mark}
          </span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

/** Shipping-rate table — label on the left, value (gold when highlighted). */
export function RatesTable({ rows }: { rows: RateRow[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-[#E7D9C2] bg-cream-50">
      <div className="flex justify-between bg-[#F3E9DA] px-6 py-4 text-[12px] font-semibold uppercase leading-none tracking-[0.1em] text-maroon-700">
        <span>Order value</span>
        <span>Shipping</span>
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between border-t border-[#EFE3D0] px-6 py-4"
        >
          <span className="text-[14px] leading-[1.4] text-maroon-900">
            {row.label}
          </span>
          <span
            className={`text-[14px] font-semibold leading-none ${
              row.highlight ? "text-gold-600" : "text-maroon-900"
            }`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

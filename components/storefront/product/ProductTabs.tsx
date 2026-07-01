"use client";

import { useState } from "react";

type TabId = "description" | "details" | "shipping";

export type ProductTabsData = {
  descLong: string | null;
  material: string | null;
  plating: string | null;
  stones: string | null;
  care: string | null;
  shippingNote: string | null;
};

const TABS: { id: TabId; label: string }[] = [
  { id: "description", label: "Description" },
  { id: "details", label: "Details" },
  { id: "shipping", label: "Shipping & Returns" },
];

/**
 * Tabbed product copy — Description / Details / Shipping — matched to the
 * storefront prototype. The Details tab renders a key/value spec table from the
 * product's structured fields; missing values fall back to an em dash so the
 * layout stays stable.
 */
export function ProductTabs({ data }: { data: ProductTabsData }) {
  const [active, setActive] = useState<TabId>("description");
  const fallback = "—";

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Product information"
        className="flex gap-6 border-b border-[#E7D9C2]"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={`border-b-2 py-3 text-[12.5px] font-medium uppercase leading-none tracking-[0.1em] transition-colors ${
                isActive
                  ? "border-maroon-700 text-maroon-900"
                  : "border-transparent text-[#9C8A84] hover:text-maroon-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="min-h-[84px] text-[14px] font-light leading-[1.7] text-[#5E4A44]"
      >
        {active === "description" && (
          <p className="m-0">{data.descLong ?? "No description available."}</p>
        )}

        {active === "details" && (
          <dl className="flex flex-col gap-2">
            <SpecRow label="Material" value={data.material ?? fallback} />
            <SpecRow label="Plating" value={data.plating ?? fallback} />
            <SpecRow label="Stones" value={data.stones ?? fallback} />
            <SpecRow label="Care" value={data.care ?? fallback} />
          </dl>
        )}

        {active === "shipping" && (
          <p className="m-0">
            {data.shippingNote ??
              "Dispatched in 2–4 working days with tracking. Cash on Delivery available across India."}
          </p>
        )}
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex max-w-[340px] justify-between gap-4">
      <dt className="text-[#9C8A84]">{label}</dt>
      <dd className="m-0 text-right">{value}</dd>
    </div>
  );
}

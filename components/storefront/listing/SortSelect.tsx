"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChangeEvent } from "react";
import type { ProductSort } from "@/lib/db/queries";
import { LISTING_PARAMS } from "@/lib/listing";

const OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
];

/**
 * Sort control for the listing pages. Writes the choice to the `sort` search
 * param (dropping it for the default) so the ordering is shareable and survives
 * navigation, then lets the server component re-query.
 */
export function SortSelect({ value }: { value: ProductSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "featured") {
      params.delete(LISTING_PARAMS.sort);
    } else {
      params.set(LISTING_PARAMS.sort, next);
    }
    // A re-sort can land the current page past the end (or just confuse the
    // user) — always back to page 1 (TASKS 4.17).
    params.delete(LISTING_PARAMS.page);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2.5">
      <span className="text-[12px] font-medium uppercase leading-none tracking-[0.08em] text-[#7A655F]">
        Sort
      </span>
      <select
        value={value}
        onChange={handleChange}
        className="cursor-pointer rounded-sm border border-[#E7D9C2] bg-white px-3 py-2.5 text-[13px] leading-none text-maroon-900 outline-none transition-colors focus-visible:border-gold-400"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

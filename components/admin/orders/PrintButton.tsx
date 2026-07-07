"use client";

/**
 * The one interactive piece of the print surface (5.12) — kept to a tiny client
 * island so `OrderPrintView` itself stays a server component.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-maroon-700 px-[18px] py-[10px] font-body text-[12px] font-semibold text-cream-200 transition-opacity hover:opacity-90"
    >
      Print
    </button>
  );
}

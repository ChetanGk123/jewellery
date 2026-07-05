/**
 * Client-safe product-analytics types + presentation helpers (TASKS 3.10). Free
 * of `server-only` imports so the client `AnalyticsView` and the server data
 * module (`lib/db/admin-analytics.ts`) can share them. Mirrors the split used by
 * the other admin views. All figures are derived from real `order_item` history
 * server-side — no fake sparkline data (the prototype's placeholders are gone).
 */

/** How the performance table is ordered. */
export type AnalyticsSort = "units" | "revenue" | "stock" | "price";

export const ANALYTICS_SORTS: { value: AnalyticsSort; label: string }[] = [
  { value: "units", label: "Top selling" },
  { value: "revenue", label: "Revenue" },
  { value: "stock", label: "Lowest stock" },
  { value: "price", label: "Highest price" },
];

/** One month in a product's sales history (oldest → newest, 6 entries). */
export type MonthlyPoint = {
  /** Short IST month label, e.g. "Feb". */
  label: string;
  units: number;
  revenuePaise: number;
};

/** A product row with its 6-month sales aggregates. */
export type AnalyticsProduct = {
  id: string;
  name: string;
  sku: string;
  slug: string;
  status: string;
  imageUrl: string | null;
  categoryName: string;
  stock: number;
  pricePaise: number;
  units6mo: number;
  revenuePaise6mo: number;
  /** Recent-3-months vs prior-3-months change, %; null when there's no baseline. */
  trendPct: number | null;
  monthly: MonthlyPoint[];
};

/** One KPI card at the top of the view. */
export type AnalyticsKpi = { label: string; value: string; accent: string };

export type AnalyticsData = {
  kpis: AnalyticsKpi[];
  products: AnalyticsProduct[];
};

/** Order the products for the chosen sort (returns a new array — no mutation). */
export function sortAnalytics(
  products: AnalyticsProduct[],
  sort: AnalyticsSort,
): AnalyticsProduct[] {
  const copy = [...products];
  switch (sort) {
    case "revenue":
      return copy.sort((a, b) => b.revenuePaise6mo - a.revenuePaise6mo);
    case "stock":
      return copy.sort((a, b) => a.stock - b.stock);
    case "price":
      return copy.sort((a, b) => b.pricePaise - a.pricePaise);
    case "units":
    default:
      return copy.sort((a, b) => b.units6mo - a.units6mo);
  }
}

/** Trend text — "+18%", "-4%", or "—" when there's no prior baseline. */
export function trendLabel(pct: number | null): string {
  if (pct === null) return "—";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/** Green up / red down / muted flat. */
export function trendColor(pct: number | null): string {
  if (pct === null || pct === 0) return "#8A7E74";
  return pct > 0 ? "#1B7A3D" : "#C0392F";
}

/** One bar in a row's mini-sparkline: a CSS height + a colour. */
export type SparkBar = { height: string; color: string };

/**
 * Normalise a product's monthly units into fixed-height bars (px), scaled to the
 * product's own peak so the shape reads even for low-volume items. A zero month
 * still shows a faint stub so the six-slot rhythm stays visible.
 */
export function sparkBars(monthly: MonthlyPoint[], maxPx = 30): SparkBar[] {
  const peak = Math.max(1, ...monthly.map((m) => m.units));
  return monthly.map((m) => {
    const ratio = m.units / peak;
    const px = Math.max(3, Math.round(ratio * maxPx));
    return {
      height: `${px}px`,
      color: m.units === 0 ? "#EAE0CE" : "#C9A24B",
    };
  });
}

import "server-only";
import type {
  AnalyticsData,
  AnalyticsKpi,
  AnalyticsProduct,
  MonthlyPoint,
} from "@/lib/admin/analytics";
import { productDisplayChip } from "@/lib/admin/product-status";
import { formatPaise } from "@/lib/utils/money";
import { createServerClient } from "./server";

/** How many months of history the view covers. */
const MONTHS = 6;
/** Split point for the trend calc: recent half vs prior half of the window. */
const HALF = MONTHS / 2;

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type Bucket = { key: string; label: string };

const EMPTY: AnalyticsData = {
  kpis: [
    { label: "Units sold · 6 mo", value: "0", accent: "#71182B" },
    { label: "Revenue · 6 mo", value: formatPaise(0), accent: "#1B7A3D" },
    { label: "Best seller", value: "—", accent: "#B7791F" },
    { label: "Low / out of stock", value: "0", accent: "#C0392F" },
  ],
  products: [],
};

/**
 * Product analytics (TASKS 3.10). Reads the last-6-months, non-cancelled orders
 * and their line items through the admin cookie session (0006 `order` /
 * `order_item` admin-read RLS) and folds them into per-product units/revenue,
 * an IST monthly history, and a recent-vs-prior trend. Every product appears —
 * ones with no sales just carry zeros. Degrades to empty on error so the
 * console chrome still renders.
 */
export async function getProductAnalytics(): Promise<AnalyticsData> {
  try {
    const supabase = await createServerClient();
    const buckets = buildBuckets(new Date());
    const cutoffIso = windowCutoffIso(buckets);
    const bucketIndex = new Map(buckets.map((b, i) => [b.key, i]));

    // 1) Products (all of them, so zero-sale items still list + sort).
    const { data: products } = await supabase
      .from("product")
      .select(
        "id, name, sku, slug, stock, price_paise, status, primary_image_url, category(name)",
      )
      .order("name", { ascending: true });

    // 2) Non-cancelled orders inside the window → id + when.
    const { data: orders } = await supabase
      .from("order")
      .select("id, created_at")
      .neq("status", "Cancelled")
      .gte("created_at", cutoffIso);

    const orderMonth = new Map<string, number>();
    for (const o of orders ?? []) {
      const idx = bucketIndex.get(istMonthKey(new Date(o.created_at)));
      if (idx !== undefined) orderMonth.set(o.id, idx);
    }

    // 3) Line items for those orders → per-product monthly tallies.
    const perProduct = new Map<string, number[][]>(); // productId → [monthIdx][units, revenue]
    const orderIds = [...orderMonth.keys()];
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from("order_item")
        .select("product_id, qty, line_total_paise, order_id")
        .in("order_id", orderIds);

      for (const it of items ?? []) {
        const idx = orderMonth.get(it.order_id);
        if (idx === undefined) continue;
        const tally =
          perProduct.get(it.product_id) ??
          Array.from({ length: MONTHS }, () => [0, 0]);
        tally[idx][0] += it.qty;
        tally[idx][1] += it.line_total_paise;
        perProduct.set(it.product_id, tally);
      }
    }

    const rows: AnalyticsProduct[] = (products ?? []).map((p) => {
      const tally =
        perProduct.get(p.id) ?? Array.from({ length: MONTHS }, () => [0, 0]);
      const monthly: MonthlyPoint[] = buckets.map((b, i) => ({
        label: b.label,
        units: tally[i][0],
        revenuePaise: tally[i][1],
      }));
      const units6mo = monthly.reduce((s, m) => s + m.units, 0);
      const revenuePaise6mo = monthly.reduce((s, m) => s + m.revenuePaise, 0);

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        slug: p.slug,
        status: p.status,
        imageUrl: p.primary_image_url,
        categoryName: categoryName(p.category),
        stock: p.stock,
        pricePaise: p.price_paise,
        units6mo,
        revenuePaise6mo,
        trendPct: trend(monthly),
        monthly,
      };
    });

    return { kpis: buildKpis(rows), products: rows };
  } catch {
    return EMPTY;
  }
}

/** Recent-half vs prior-half units change, %; null when there's no baseline. */
function trend(monthly: MonthlyPoint[]): number | null {
  const prior = monthly.slice(0, HALF).reduce((s, m) => s + m.units, 0);
  const recent = monthly.slice(HALF).reduce((s, m) => s + m.units, 0);
  if (prior === 0) return null;
  return Math.round(((recent - prior) / prior) * 100);
}

function buildKpis(rows: AnalyticsProduct[]): AnalyticsKpi[] {
  const units = rows.reduce((s, r) => s + r.units6mo, 0);
  const revenue = rows.reduce((s, r) => s + r.revenuePaise6mo, 0);
  const best = rows.reduce<AnalyticsProduct | null>(
    (top, r) => (r.units6mo > 0 && (!top || r.units6mo > top.units6mo) ? r : top),
    null,
  );
  const lowOrOut = rows.filter((r) => {
    const label = productDisplayChip(r.status, r.stock).label;
    return label === "Low stock" || label === "Out of stock";
  }).length;

  return [
    { label: "Units sold · 6 mo", value: String(units), accent: "#71182B" },
    { label: "Revenue · 6 mo", value: formatPaise(revenue), accent: "#1B7A3D" },
    { label: "Best seller", value: best ? best.name : "—", accent: "#B7791F" },
    { label: "Low / out of stock", value: String(lowOrOut), accent: "#C0392F" },
  ];
}

/** The 6 IST month buckets ending with `now`'s month (oldest → newest). */
function buildBuckets(now: Date): Bucket[] {
  const { year, month } = istYearMonth(now); // month is 1-12
  const out: Bucket[] = [];
  for (let back = MONTHS - 1; back >= 0; back--) {
    // month is 1-based; shift with a 0-based intermediate to wrap years.
    const zero = month - 1 - back;
    const y = year + Math.floor(zero / 12);
    const m = ((zero % 12) + 12) % 12; // 0-11
    out.push({ key: `${y}-${String(m + 1).padStart(2, "0")}`, label: MONTH_LABELS[m] });
  }
  return out;
}

/** A UTC instant safely before the oldest IST bucket (12h buffer > IST offset). */
function windowCutoffIso(buckets: Bucket[]): string {
  const [y, m] = buckets[0].key.split("-").map(Number);
  const utcMonthStart = Date.UTC(y, m - 1, 1);
  return new Date(utcMonthStart - 12 * 60 * 60 * 1000).toISOString();
}

const IST_YM = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
});

function istMonthKey(date: Date): string {
  const parts = IST_YM.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${year}-${month}`;
}

function istYearMonth(date: Date): { year: number; month: number } {
  const [year, month] = istMonthKey(date).split("-").map(Number);
  return { year, month };
}

/** The embedded `category(name)` can come back as an object or a 1-row array. */
function categoryName(category: unknown): string {
  if (Array.isArray(category)) {
    return (category[0] as { name?: string } | undefined)?.name ?? "—";
  }
  if (category && typeof category === "object") {
    return (category as { name?: string }).name ?? "—";
  }
  return "—";
}

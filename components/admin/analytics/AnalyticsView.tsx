"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type AnalyticsKpi,
  type AnalyticsProduct,
  type AnalyticsSort,
  ANALYTICS_SORTS,
  sortAnalytics,
  sparkBars,
  trendColor,
  trendLabel,
} from "@/lib/admin/analytics";
import { productDisplayChip, stockColor } from "@/lib/admin/product-status";
import { ROUTES } from "@/lib/routes";
import { formatPaise } from "@/lib/utils/money";

type Props = {
  kpis: AnalyticsKpi[];
  products: AnalyticsProduct[];
};

/**
 * Product Analytics (TASKS 3.10, prototype-matched). A list view — 4 KPI cards
 * over a sortable "Performance by product" table (spark bars from real monthly
 * units) — and a per-product detail view (stat cards + a units-per-month chart +
 * an Edit-product link back to the catalogue). List ↔ detail is client state, so
 * the whole dataset loads once server-side and no route change is needed.
 */
export function AnalyticsView({ kpis, products }: Props) {
  const [sort, setSort] = useState<AnalyticsSort>("units");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = useMemo(() => sortAnalytics(products, sort), [products, sort]);
  const selected = selectedId
    ? products.find((p) => p.id === selectedId) ?? null
    : null;

  if (selected) {
    return (
      <ProductDetail product={selected} onBack={() => setSelectedId(null)} />
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {/* KPI cards */}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="flex flex-col gap-2 rounded-xl border border-[#EAE3D7] bg-white px-5 py-[18px]"
          >
            <span className="font-body text-[12px] font-medium leading-none text-[#8A7E74]">
              {k.label}
            </span>
            <span
              className="truncate font-body text-[26px] font-semibold leading-[1.1]"
              style={{ color: k.accent }}
              title={k.value}
            >
              {k.value}
            </span>
          </div>
        ))}
      </div>

      {/* Performance table */}
      <div className="overflow-hidden rounded-xl border border-[#EAE3D7] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE9DE] px-[22px] py-[18px]">
          <span className="font-body text-[15px] font-semibold text-[#2A1F1A]">
            Performance by product
          </span>
          <label className="flex items-center gap-2 font-body text-[12px] font-medium text-[#8A7E74]">
            Sort by
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as AnalyticsSort)}
              className="cursor-pointer rounded-lg border border-[#E7E0D4] bg-white px-[11px] py-2 font-body text-[13px] text-[#2A1F1A]"
            >
              {ANALYTICS_SORTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {products.length === 0 ? (
          <div className="px-[22px] py-[50px] text-center font-body text-[13px] text-[#A99C90]">
            No products yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[840px]">
              <div className="flex items-center gap-[14px] border-b border-[#EFE9DE] bg-[#FBF8F2] px-[22px] py-3 font-body text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A99C90]">
                <span className="flex-1">Product</span>
                <span className="w-[90px] text-right">Price</span>
                <span className="w-16 text-center">Stock</span>
                <span className="w-[90px] text-right">Units 6mo</span>
                <span className="w-[110px] text-right">Revenue</span>
                <span className="w-[74px] text-right">Trend</span>
                <span className="w-[104px] text-center">History</span>
              </div>

              {sorted.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className="flex w-full items-center gap-[14px] border-b border-[#F3EEE4] px-[22px] py-[13px] text-left transition-colors hover:bg-[#FBF8F2]"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <Swatch product={p} size={38} />
                    <span className="min-w-0">
                      <span className="block truncate font-body text-[13.5px] font-medium leading-[1.2] text-[#2A1F1A]">
                        {p.name}
                      </span>
                      <span className="mt-[3px] block font-body text-[11px] leading-none text-[#A99C90]">
                        {p.sku}
                      </span>
                    </span>
                  </span>
                  <span className="w-[90px] text-right font-body text-[13px] font-semibold text-[#2A1F1A]">
                    {formatPaise(p.pricePaise)}
                  </span>
                  <span
                    className="w-16 text-center font-body text-[13px] font-medium"
                    style={{ color: stockColor(p.status, p.stock) }}
                  >
                    {p.stock}
                  </span>
                  <span className="w-[90px] text-right font-body text-[13px] font-medium text-[#2A1F1A]">
                    {p.units6mo}
                  </span>
                  <span className="w-[110px] text-right font-body text-[13px] font-semibold text-[#71182B]">
                    {formatPaise(p.revenuePaise6mo)}
                  </span>
                  <span
                    className="w-[74px] text-right font-body text-[12px] font-semibold"
                    style={{ color: trendColor(p.trendPct) }}
                  >
                    {trendLabel(p.trendPct)}
                  </span>
                  <span className="flex h-[34px] w-[104px] items-end justify-center gap-[3px]">
                    {sparkBars(p.monthly).map((b, i) => (
                      <span
                        key={i}
                        className="w-[9px] rounded-t-[2px]"
                        style={{ height: b.height, background: b.color }}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The per-product breakdown: header, six stat cards, and a monthly bar chart. */
function ProductDetail({
  product,
  onBack,
}: {
  product: AnalyticsProduct;
  onBack: () => void;
}) {
  const chip = productDisplayChip(product.status, product.stock);
  const thisMonth = product.monthly[product.monthly.length - 1];
  const peakUnits = Math.max(1, ...product.monthly.map((m) => m.units));

  const cards: { label: string; value: string; accent: string }[] = [
    { label: "Units · 6 mo", value: String(product.units6mo), accent: "#71182B" },
    {
      label: "Revenue · 6 mo",
      value: formatPaise(product.revenuePaise6mo),
      accent: "#1B7A3D",
    },
    { label: "Trend", value: trendLabel(product.trendPct), accent: trendColor(product.trendPct) },
    { label: "Units this month", value: String(thisMonth?.units ?? 0), accent: "#B7791F" },
    {
      label: "In stock",
      value: String(product.stock),
      accent: stockColor(product.status, product.stock),
    },
    { label: "Price", value: formatPaise(product.pricePaise), accent: "#2A1F1A" },
  ];

  return (
    <div className="flex flex-col gap-[18px]">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-[7px] font-body text-[13px] font-medium text-[#71182B]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        All products
      </button>

      {/* Header card */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#EAE3D7] bg-white p-[22px]">
        <Swatch product={product} size={56} radius={10} />
        <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-heading text-[22px] font-semibold leading-[1.1] text-[#2A1F1A]">
              {product.name}
            </span>
            <span
              className="rounded-full px-2.5 py-[5px] font-body text-[11px] font-semibold"
              style={{ color: chip.color, background: chip.bg }}
            >
              {chip.label}
            </span>
          </div>
          <span className="font-body text-[12px] text-[#A99C90]">
            {product.sku} · {product.categoryName}
          </span>
        </div>
        <Link
          href={`${ROUTES.adminProducts}?edit=${product.id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-[#71182B] px-[18px] py-[11px] font-body text-[12px] font-semibold text-[#F3E3C7] transition-opacity hover:opacity-90"
        >
          Edit product
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {cards.map((c) => (
          <div
            key={c.label}
            className="flex flex-col gap-2 rounded-xl border border-[#EAE3D7] bg-white px-5 py-[18px]"
          >
            <span className="font-body text-[12px] font-medium leading-none text-[#8A7E74]">
              {c.label}
            </span>
            <span
              className="truncate font-body text-[24px] font-semibold leading-[1.1]"
              style={{ color: c.accent }}
              title={c.value}
            >
              {c.value}
            </span>
          </div>
        ))}
      </div>

      {/* Sales history chart */}
      <div className="rounded-xl border border-[#EAE3D7] bg-white p-[22px]">
        <div className="mb-5 flex items-baseline justify-between">
          <span className="font-body text-[15px] font-semibold text-[#2A1F1A]">
            Sales history — units per month
          </span>
          <span className="font-body text-[12px] font-medium text-[#8A7E74]">
            Last 6 months
          </span>
        </div>
        <div className="flex h-[180px] items-end gap-4">
          {product.monthly.map((m, i) => {
            const heightPct = Math.round((m.units / peakUnits) * 100);
            return (
              <div
                key={i}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="font-body text-[12px] font-semibold text-[#2A1F1A]">
                  {m.units}
                </span>
                <div
                  className="w-full max-w-[48px] rounded-t-[5px]"
                  style={{
                    height: `${Math.max(2, heightPct)}%`,
                    background: m.units === 0 ? "#EFE7D6" : "#C9A24B",
                  }}
                  title={`${m.units} units · ${formatPaise(m.revenuePaise)}`}
                />
                <span className="font-body text-[11px] font-medium text-[#A99C90]">
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Soft gold tile shown when a product has no image (matches ProductsView). */
const PLACEHOLDER_GRADIENT = "linear-gradient(135deg, #F3E3C7, #E6CA7E)";

/**
 * Product thumbnail — the real image when we have one, else a soft gold tint.
 * Mirrors the `ProductsView` swatch (trusted admin `imageUrl`, host-restricted
 * origin; `bg-cover bg-center` + inline `backgroundImage`).
 */
function Swatch({
  product,
  size,
  radius = 8,
}: {
  product: AnalyticsProduct;
  size: number;
  radius?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex-none border border-[#EFE3D0] bg-cover bg-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundImage: product.imageUrl
          ? `url(${product.imageUrl})`
          : PLACEHOLDER_GRADIENT,
      }}
    />
  );
}

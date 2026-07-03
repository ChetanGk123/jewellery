import Link from "next/link";
import type {
  DashboardData,
  DashboardKpis,
  LowStockRow,
  RecentOrderRow,
  RevenueBar,
  TopSellerRow,
} from "@/lib/db/admin-dashboard";
import { ROUTES } from "@/lib/routes";
import { PLACEHOLDER_GRADIENT } from "@/lib/theme";
import { formatPaise } from "@/lib/utils/money";

/** Compact Indian ₹ for chart/KPI labels: ₹0, ₹850, ₹39k, ₹2.4L, ₹1.1Cr. */
function compactInr(paise: number): string {
  const r = paise / 100;
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(1)}Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)}L`;
  if (r >= 1e3) return `₹${Math.round(r / 1e3)}k`;
  return `₹${Math.round(r)}`;
}

const CARD = "rounded-xl border border-[#EAE3D7] bg-white";

export function DashboardView({ data }: { data: DashboardData }) {
  const totalRevenue7d = data.revenue7d.reduce((s, b) => s + b.revenuePaise, 0);

  return (
    <div className="flex flex-col gap-6">
      <KpiRow kpis={data.kpis} />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-[18px]">
          <RevenueChart bars={data.revenue7d} totalPaise={totalRevenue7d} />
          <RecentOrders orders={data.recentOrders} />
        </div>
        <div className="flex flex-col gap-[18px]">
          <LowStockAlerts rows={data.lowStock} />
          <TopSellers rows={data.topSellers} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- KPI cards ------------------------------- */

function KpiRow({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Orders Today"
        value={String(kpis.ordersToday)}
        iconBg="#F3E9DA"
        icon={
          <>
            <path d="M6 7h12l-1 13H7L6 7Z" />
            <path d="M9 7a3 3 0 0 1 6 0" />
          </>
        }
        iconStroke="#A87A1E"
        foot={<Delta pct={kpis.ordersDeltaPct} />}
      />
      <KpiCard
        label="Revenue Today"
        value={formatPaise(kpis.revenueTodayPaise)}
        iconBg="#E7F3EB"
        iconStroke="#1B7A3D"
        icon={<path d="M7 5h10M7 9h10M9 13c4 0 4-4 0-4M7 13h4l5 6" />}
        foot={<Delta pct={kpis.revenueDeltaPct} />}
      />
      <KpiCard
        label="Pending Orders"
        value={String(kpis.pendingOrders)}
        iconBg="#FBF1DD"
        iconStroke="#B7791F"
        icon={
          <>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v4l3 2" />
          </>
        }
        foot={<FootLink href={ROUTES.adminOrders}>Needs processing →</FootLink>}
      />
      <KpiCard
        label="Low / Out of Stock"
        value={String(kpis.lowStockCount)}
        iconBg="#FBE9E7"
        iconStroke="#C0392F"
        icon={
          <>
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4M12 17v.5" />
          </>
        }
        foot={<FootLink href={ROUTES.adminProducts}>Restock now →</FootLink>}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  iconBg,
  iconStroke,
  foot,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconStroke: string;
  foot: React.ReactNode;
}) {
  return (
    <div className={`${CARD} flex flex-col gap-3 p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium tracking-[0.04em] text-[#8A7E74]">
          {label}
        </span>
        <span
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]"
          style={{ background: iconBg }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={iconStroke}
            strokeWidth={1.8}
            aria-hidden="true"
          >
            {icon}
          </svg>
        </span>
      </div>
      <span className="text-[32px] font-semibold leading-none text-[#2A1F1A]">
        {value}
      </span>
      {foot}
    </div>
  );
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="text-[12px] font-medium text-[#A99C90]">
        No baseline yesterday
      </span>
    );
  }
  const up = pct >= 0;
  return (
    <span
      className="text-[12px] font-medium"
      style={{ color: up ? "#1B7A3D" : "#C0392F" }}
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}% vs yesterday
    </span>
  );
}

function FootLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[12px] font-medium text-maroon-700 hover:underline"
    >
      {children}
    </Link>
  );
}

/* ----------------------------- Revenue chart ----------------------------- */

const CHART_HEIGHT = 150;

function RevenueChart({
  bars,
  totalPaise,
}: {
  bars: RevenueBar[];
  totalPaise: number;
}) {
  const peak = Math.max(0, ...bars.map((b) => b.revenuePaise));

  return (
    <div className={`${CARD} p-[22px]`}>
      <div className="mb-5 flex items-baseline justify-between">
        <span className="text-[15px] font-semibold text-[#2A1F1A]">
          Revenue — last 7 days
        </span>
        <span className="text-[18px] font-semibold text-maroon-700">
          {formatPaise(totalPaise)}
        </span>
      </div>
      {bars.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[#A99C90]">
          No revenue data yet.
        </p>
      ) : (
        <div
          className="flex items-end gap-[14px]"
          style={{ height: CHART_HEIGHT }}
        >
          {bars.map((b, i) => {
            const h =
              peak > 0 ? Math.max(6, Math.round((b.revenuePaise / peak) * 128)) : 6;
            return (
              <div
                key={i}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="text-[11px] font-medium text-[#8A7E74]">
                  {compactInr(b.revenuePaise)}
                </span>
                <div
                  className="w-full max-w-[42px] rounded-t-[5px]"
                  style={{
                    height: h,
                    background: b.isPeak ? "#71182B" : "#C9A24B",
                  }}
                />
                <span className="text-[11px] font-medium text-[#A99C90]">
                  {b.day}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Recent orders ----------------------------- */

function RecentOrders({ orders }: { orders: RecentOrderRow[] }) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#EFE9DE] px-[22px] py-[18px]">
        <span className="text-[15px] font-semibold text-[#2A1F1A]">
          Recent Orders
        </span>
        <Link
          href={ROUTES.adminOrders}
          className="text-[12px] font-medium text-maroon-700 hover:underline"
        >
          View all →
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="px-[22px] py-10 text-center text-[13px] text-[#A99C90]">
          No orders yet.
        </p>
      ) : (
        orders.map((o) => (
          <div
            key={o.orderNo}
            className="flex items-center gap-3.5 border-b border-[#F3EEE4] px-[22px] py-3.5 last:border-b-0"
          >
            <span className="w-[120px] shrink-0 text-[13px] font-semibold text-maroon-700">
              {o.orderNo}
            </span>
            <span className="flex-1 truncate text-[13px] text-[#2A1F1A]">
              {o.customer}
            </span>
            <span className="hidden w-[90px] shrink-0 text-[12px] text-[#8A7E74] sm:block">
              {o.dateLabel}
            </span>
            <span className="w-[80px] shrink-0 text-right text-[13px] font-semibold text-[#2A1F1A]">
              {formatPaise(o.totalPaise)}
            </span>
            <span
              className="w-[92px] shrink-0 rounded-full py-[5px] text-center text-[11px] font-semibold"
              style={{ color: o.chip.color, background: o.chip.bg }}
            >
              {o.chip.label}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

/* ---------------------------- Low stock alerts --------------------------- */

function Swatch() {
  return (
    <div
      className="h-[38px] w-[38px] shrink-0 rounded-lg border border-[#EFE3D0]"
      style={{ background: PLACEHOLDER_GRADIENT }}
    />
  );
}

function LowStockAlerts({ rows }: { rows: LowStockRow[] }) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-4 flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#C0392F"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path d="M12 3 2 20h20L12 3Z" />
          <path d="M12 10v4M12 17v.5" />
        </svg>
        <span className="text-[15px] font-semibold text-[#2A1F1A]">
          Low Stock Alerts
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-[#A99C90]">
          Everything is well stocked.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((l) => {
            const out = l.stock <= 0;
            return (
              <div key={l.sku} className="flex items-center gap-3">
                <Swatch />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-[#2A1F1A]">
                    {l.name}
                  </div>
                  <div className="mt-[3px] text-[11px] text-[#A99C90]">{l.sku}</div>
                </div>
                <span
                  className="shrink-0 whitespace-nowrap rounded-md px-2 py-[5px] text-[11px] font-semibold"
                  style={
                    out
                      ? { color: "#C0392F", background: "#FBE9E7" }
                      : { color: "#B7791F", background: "#FBF1DD" }
                  }
                >
                  {out ? "Out of stock" : `${l.stock} left`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Top sellers ------------------------------ */

function TopSellers({ rows }: { rows: TopSellerRow[] }) {
  return (
    <div className={`${CARD} p-5`}>
      <span className="text-[15px] font-semibold text-[#2A1F1A]">
        Top Sellers This Month
      </span>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-[#A99C90]">
          No sales this month yet.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3.5">
          {rows.map((tp, i) => (
            <div key={`${tp.name}-${i}`} className="flex items-center gap-3">
              <Swatch />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[#2A1F1A]">
                  {tp.name}
                </div>
                <div className="mt-[3px] text-[11px] text-[#A99C90]">
                  {tp.units} sold
                </div>
              </div>
              <span className="shrink-0 text-[13px] font-semibold text-maroon-700">
                {formatPaise(tp.revenuePaise)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

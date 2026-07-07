"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  exportOrders,
  setOrderStatus,
} from "@/app/(admin)/admin/(console)/orders/actions";
import { pendingAge } from "@/lib/admin/order-aging";
import {
  nextStatus,
  statusChip,
  ORDER_STATUSES,
  ORDERS_PAGE_SIZE,
} from "@/lib/admin/order-status";
import { csvRow } from "@/lib/utils/csv";
import type {
  AdminOrderRow,
  AdminOrdersPage,
  OrderEvent,
  OrderFilter,
} from "@/lib/db/admin-orders";
import { ROUTES } from "@/lib/routes";
import { formatPaise } from "@/lib/utils/money";
import { AdminPager } from "@/components/admin/ui/AdminPager";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import { OrderDrawer } from "./OrderDrawer";

const TABS: OrderFilter[] = ["All", ...ORDER_STATUSES];

function hrefFor(filter: OrderFilter, page: number, search: string): string {
  const params = new URLSearchParams();
  if (filter !== "All") params.set("status", filter);
  if (page > 1) params.set("page", String(page));
  if (search) params.set("q", search);
  const qs = params.toString();
  return qs ? `${ROUTES.adminOrders}?${qs}` : ROUTES.adminOrders;
}

export function OrdersView({ page }: { page: AdminOrdersPage }) {
  const router = useRouter();
  // Search box is URL-driven (`?q=`) like the status/page params, so a search
  // is shareable and survives refresh. Seed the input from the served value.
  const [query, setQuery] = useState(page.search);

  const submitSearch = (raw: string) => {
    const next = raw.trim();
    // Preserve the active status tab; drop the page so results start at 1.
    router.push(hrefFor(page.filter, 1, next));
  };

  // A snapshot of the open order — held locally (not derived from page.rows) so
  // the drawer survives revalidation and stays open even when a status change
  // moves the order out of the active filter. Only the backdrop / × close it.
  const [selected, setSelected] = useState<AdminOrderRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cancel is terminal (restores stock, can't be undone) — gate it behind a
  // confirm dialog so it can't fire on a single misclick (TASKS 5.4).
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isPending, startTransition] = useTransition();

  const openOrder = (order: AdminOrderRow) => {
    setError(null);
    setSelected(order);
  };
  const closeOrder = () => {
    setSelected(null);
    setError(null);
    setConfirmingCancel(false);
  };

  const runChange = (next: string) => {
    if (!selected) return;
    startTransition(async () => {
      const res = await setOrderStatus(selected.id, next);
      if (res.ok) {
        setError(null);
        setConfirmingCancel(false);
        // Keep the drawer open; reflect the confirmed new status in place,
        // including a timeline entry mirroring what the audit trigger just
        // wrote (the served rows carry the real one after revalidation).
        setSelected((prev) =>
          prev
            ? {
                ...prev,
                status: next,
                events: [
                  ...prev.events,
                  {
                    id: `local-${prev.id}-${prev.events.length}`,
                    kind: "status",
                    summary: `${prev.status} → ${next}`,
                    actorEmail: null,
                    atLabel: "Just now",
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : prev,
        );
      } else {
        setError(res.error ?? "Couldn't update the order.");
      }
    });
  };

  // A saved note comes back as its real audit row — append it to the open
  // drawer's snapshot so the timeline updates without a refetch.
  const onNoteAdded = (event: OrderEvent) => {
    setSelected((prev) =>
      prev ? { ...prev, events: [...prev.events, event] } : prev,
    );
  };

  const onAdvance = () => {
    if (!selected) return;
    const next = nextStatus(selected.status);
    if (next) runChange(next);
  };

  // CSV for the accountant (5.18): the whole order book (capped server-side),
  // money in rupees with paise as decimals. Built client-side like the
  // subscribers export.
  const [isExporting, setIsExporting] = useState(false);
  const exportCsv = async () => {
    setError(null);
    setIsExporting(true);
    try {
      const all = await exportOrders();
      const inr = (paise: number) => (paise / 100).toFixed(2);
      const lines = [
        csvRow([
          "order_no", "date", "status", "payment", "customer", "phone",
          "email", "city", "state", "pincode", "coupon", "subtotal_inr",
          "discount_inr", "shipping_inr", "total_inr",
        ]),
        ...all.map((o) =>
          csvRow([
            o.orderNo, o.date, o.status, o.payment, o.customer, o.phone,
            o.email, o.city, o.state, o.pincode, o.couponCode,
            inr(o.subtotalPaise), inr(o.discountPaise), inr(o.shippingPaise),
            inr(o.totalPaise),
          ]),
        ),
      ];
      const blob = new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "orders.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't export the orders.");
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <div className="flex flex-col gap-[18px]">
      {/* Search — order no / customer / phone / email */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch(query);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <div className="flex min-w-[220px] flex-1 items-center rounded-lg border border-[#E7E0D4] bg-white px-3">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9C8A7E"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search orders by number, customer, phone or email"
            placeholder="Search order no, customer, phone, email…"
            className="w-full flex-1 border-none bg-transparent px-2 py-[9px] text-[13px] text-[#2A1F1A] outline-none placeholder:text-[#9C8A7E]"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-maroon-700 px-[18px] py-[10px] text-[12px] font-semibold text-cream-200 transition-opacity hover:opacity-90"
        >
          Search
        </button>
        {page.search && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              submitSearch("");
            }}
            className="rounded-lg border border-[#E7E0D4] bg-white px-[18px] py-[10px] text-[12px] font-semibold text-[#5E4A40] transition-colors hover:border-[#D8CDB9]"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={exportCsv}
          disabled={isExporting}
          className="rounded-lg border border-[#E7E0D4] bg-white px-[18px] py-[10px] text-[12px] font-semibold text-[#5E4A40] transition-colors hover:border-[#D8CDB9] disabled:opacity-60"
        >
          {isExporting ? "Exporting…" : "Export CSV"}
        </button>
      </form>

      {page.search && (
        <p className="-mt-2 text-[12.5px] text-[#8A7E74]">
          {page.total === 0
            ? `No orders match “${page.search}”.`
            : `${page.total} ${page.total === 1 ? "order" : "orders"} matching “${page.search}”.`}
        </p>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = page.filter === tab;
          return (
            <Link
              key={tab}
              href={hrefFor(tab, 1, page.search)}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-4 py-[9px] text-[12.5px] font-medium transition-colors ${
                active
                  ? "border-maroon-700 bg-maroon-700 text-cream-200"
                  : "border-[#EAE3D7] bg-white text-[#5E4A40] hover:border-[#D8CDB9]"
              }`}
            >
              {tab} <span className="opacity-70">{page.counts[tab]}</span>
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#EAE3D7] bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="flex items-center gap-3.5 border-b border-[#EFE9DE] bg-[#FBF8F2] px-[22px] py-[13px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A7E74]">
              <span className="w-[130px]">Order</span>
              <span className="flex-1">Customer</span>
              <span className="w-[120px]">Date</span>
              <span className="w-[60px] text-center">Items</span>
              <span className="w-[90px] text-right">Total</span>
              <span className="w-[90px] text-center">Payment</span>
              <span className="w-[96px] text-center">Status</span>
            </div>

            {page.rows.length === 0 ? (
              <p className="px-[22px] py-[50px] text-center text-[13px] text-[#A99C90]">
                No orders with this status.
              </p>
            ) : (
              page.rows.map((o) => {
                const chip = statusChip(o.status);
                // Ageing nudge (5.18): only Pending orders go stale.
                const age =
                  o.status === "Pending"
                    ? pendingAge(o.createdAt, Date.now())
                    : null;
                return (
                  <button
                    type="button"
                    key={o.orderNo}
                    onClick={() => openOrder(o)}
                    className="flex w-full items-center gap-3.5 border-b border-[#F3EEE4] px-[22px] py-[15px] text-left transition-colors last:border-b-0 hover:bg-[#FBF8F2]"
                  >
                    <span className="w-[130px] text-[13px] font-semibold text-maroon-700">
                      {o.orderNo}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[#2A1F1A]">
                        {o.customerName}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[#A99C90]">
                        {o.city}, {o.state}
                      </span>
                    </span>
                    <span className="w-[120px] text-[12px] text-[#8A7E74]">
                      {o.dateLabel}
                    </span>
                    <span className="w-[60px] text-center text-[13px] text-[#5E4A40]">
                      {o.itemCount}
                    </span>
                    <span className="w-[90px] text-right text-[13px] font-semibold text-[#2A1F1A]">
                      {formatPaise(o.totalPaise)}
                    </span>
                    <span className="w-[90px] text-center text-[12px] text-[#5E4A40]">
                      {o.paymentLabel}
                    </span>
                    <span className="flex w-[96px] flex-col items-center gap-1">
                      <span
                        className="w-full rounded-full py-[5px] text-center text-[11px] font-semibold"
                        style={{ color: chip.color, background: chip.bg }}
                      >
                        {chip.label}
                      </span>
                      {age && (
                        <span
                          suppressHydrationWarning
                          title={`Pending for over ${age.label.replace("+", "")}`}
                          className={`rounded-full px-2 py-px text-[10px] font-semibold ${
                            age.tone === "red"
                              ? "bg-[#FBE9E7] text-[#C0392F]"
                              : "bg-[#FBF3DE] text-[#A87A1E]"
                          }`}
                        >
                          {age.label}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <AdminPager
        page={page.page}
        pageCount={page.pageCount}
        total={page.total}
        pageSize={ORDERS_PAGE_SIZE}
        hrefForPage={(n) => hrefFor(page.filter, n, page.search)}
      />

      <OrderDrawer
        order={selected}
        isOpen={selected !== null}
        onClose={closeOrder}
        onAdvance={onAdvance}
        onCancel={() => {
          setError(null);
          setConfirmingCancel(true);
        }}
        onNoteAdded={onNoteAdded}
        isPending={isPending}
        error={error}
      />

      {confirmingCancel && selected && (
        <ConfirmDialog
          title="Cancel this order?"
          body={
            <>
              <span className="font-semibold text-maroon-700">
                {selected.orderNo}
              </span>{" "}
              will be marked Cancelled and its stock returned. This can&rsquo;t
              be undone.
            </>
          }
          confirmLabel="Cancel order"
          pendingLabel="Cancelling…"
          dismissLabel="Keep order"
          isPending={isPending}
          error={error}
          onConfirm={() => runChange("Cancelled")}
          onClose={() => {
            if (!isPending) setConfirmingCancel(false);
          }}
        />
      )}
    </div>
  );
}

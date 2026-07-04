"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setOrderStatus } from "@/app/(admin)/admin/(console)/orders/actions";
import {
  nextStatus,
  statusChip,
  ORDER_STATUSES,
  ORDERS_PAGE_SIZE,
} from "@/lib/admin/order-status";
import type {
  AdminOrderRow,
  AdminOrdersPage,
  OrderFilter,
} from "@/lib/db/admin-orders";
import { ROUTES } from "@/lib/routes";
import { formatPaise } from "@/lib/utils/money";
import { OrderDrawer } from "./OrderDrawer";

const TABS: OrderFilter[] = ["All", ...ORDER_STATUSES];

function hrefFor(filter: OrderFilter, page: number): string {
  const params = new URLSearchParams();
  if (filter !== "All") params.set("status", filter);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${ROUTES.adminOrders}?${qs}` : ROUTES.adminOrders;
}

export function OrdersView({ page }: { page: AdminOrdersPage }) {
  // A snapshot of the open order — held locally (not derived from page.rows) so
  // the drawer survives revalidation and stays open even when a status change
  // moves the order out of the active filter. Only the backdrop / × close it.
  const [selected, setSelected] = useState<AdminOrderRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openOrder = (order: AdminOrderRow) => {
    setError(null);
    setSelected(order);
  };
  const closeOrder = () => {
    setSelected(null);
    setError(null);
  };

  const runChange = (next: string) => {
    if (!selected) return;
    startTransition(async () => {
      const res = await setOrderStatus(selected.id, next);
      if (res.ok) {
        setError(null);
        // Keep the drawer open; reflect the confirmed new status in place.
        setSelected((prev) => (prev ? { ...prev, status: next } : prev));
      } else {
        setError(res.error ?? "Couldn't update the order.");
      }
    });
  };

  const onAdvance = () => {
    if (!selected) return;
    const next = nextStatus(selected.status);
    if (next) runChange(next);
  };

  const rangeStart = page.total === 0 ? 0 : (page.page - 1) * ORDERS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page.page * ORDERS_PAGE_SIZE, page.total);

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = page.filter === tab;
          return (
            <Link
              key={tab}
              href={hrefFor(tab, 1)}
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
                    <span
                      className="w-[96px] rounded-full py-[5px] text-center text-[11px] font-semibold"
                      style={{ color: chip.color, background: chip.bg }}
                    >
                      {chip.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {page.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-[#8A7E74]">
            Showing {rangeStart}–{rangeEnd} of {page.total}
          </span>
          {page.pageCount > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <PagerLink
                filter={page.filter}
                page={page.page - 1}
                disabled={page.page <= 1}
              >
                ‹ Prev
              </PagerLink>
              {Array.from({ length: page.pageCount }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={hrefFor(page.filter, n)}
                  aria-current={n === page.page ? "page" : undefined}
                  className={`min-w-[34px] rounded-md border px-2.5 py-[7px] text-center text-[12px] font-semibold ${
                    n === page.page
                      ? "border-maroon-700 bg-maroon-700 text-cream-200"
                      : "border-[#E7E0D4] bg-white text-maroon-700 hover:border-[#D8CDB9]"
                  }`}
                >
                  {n}
                </Link>
              ))}
              <PagerLink
                filter={page.filter}
                page={page.page + 1}
                disabled={page.page >= page.pageCount}
              >
                Next ›
              </PagerLink>
            </div>
          )}
        </div>
      )}

      <OrderDrawer
        order={selected}
        isOpen={selected !== null}
        onClose={closeOrder}
        onAdvance={onAdvance}
        onCancel={() => runChange("Cancelled")}
        isPending={isPending}
        error={error}
      />
    </div>
  );
}

function PagerLink({
  filter,
  page,
  disabled,
  children,
}: {
  filter: OrderFilter;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const cls =
    "rounded-md border border-[#E7E0D4] bg-white px-3.5 py-[7px] text-[12px] font-semibold text-maroon-700";
  if (disabled) {
    return (
      <span className={`${cls} cursor-not-allowed opacity-40`} aria-disabled>
        {children}
      </span>
    );
  }
  return (
    <Link href={hrefFor(filter, page)} className={`${cls} hover:border-[#D8CDB9]`}>
      {children}
    </Link>
  );
}

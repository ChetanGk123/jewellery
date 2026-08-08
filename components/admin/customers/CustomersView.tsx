"use client"

import { useRouter } from "next/navigation"
import {
  CUSTOMER_SORT_LABELS,
  CUSTOMER_SORTS,
  CUSTOMERS_PAGE_SIZE,
  customerChip,
} from "@/lib/admin/customers"
import type { AdminCustomerRow, AdminCustomersPage } from "@/lib/db/admin-customers"
import { ROUTES } from "@/lib/routes"
import { formatPaise } from "@/lib/utils/money"
import { AdminPager } from "@/components/admin/ui/AdminPager"
import { AdminSearchBox } from "@/components/admin/ui/AdminSearchBox"
import { CustomerDetail } from "./CustomerDetail"
import type { AdminCustomerDetail } from "@/lib/db/admin-customers"

type Props = {
  page: AdminCustomersPage
  /**
   * Detail to open on load, resolved server-side from `?customer=`. List ↔
   * detail is a URL round-trip (not client state as in AnalyticsView) because
   * the order/review history is a second read — holding it for every row would
   * mean fetching history nobody opens.
   */
  detail: AdminCustomerDetail | null
}

export function CustomersView({ page, detail }: Props) {
  const router = useRouter()

  const hrefFor = (over: Partial<Record<"search" | "sort" | "page" | "customer", string>>) => {
    const params = new URLSearchParams()
    const s = over.search ?? page.search
    const sort = over.sort ?? page.sort
    const pg = over.page ?? "1"
    if (s.trim()) params.set("search", s.trim())
    if (sort !== "recent") params.set("sort", sort)
    if (pg !== "1") params.set("page", pg)
    if (over.customer) params.set("customer", over.customer)
    const qs = params.toString()
    return qs ? `${ROUTES.adminCustomers}?${qs}` : ROUTES.adminCustomers
  }

  if (detail) {
    return <CustomerDetail detail={detail} backHref={hrefFor({})} />
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center gap-3">
        <AdminSearchBox
          value={page.search}
          onSearch={(term) => router.replace(hrefFor({ search: term, page: "1" }))}
          placeholder="Search by name, phone or email"
          ariaLabel="Search customers by name, phone or email"
          className="min-w-[200px] max-w-[320px] flex-1"
        />

        <select
          value={page.sort}
          onChange={(e) => router.push(hrefFor({ sort: e.target.value, page: "1" }))}
          aria-label="Sort customers"
          className="cursor-pointer rounded-lg border border-[#E7E0D4] bg-white px-3 py-2.5 text-[13px] text-[#2A1F1A]"
        >
          {CUSTOMER_SORTS.map((s) => (
            <option key={s} value={s}>
              {CUSTOMER_SORT_LABELS[s]}
            </option>
          ))}
        </select>

        <span className="ml-auto text-[12.5px] text-[#8A7E74]">
          {page.total} {page.total === 1 ? "customer" : "customers"}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#EAE3D7] bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="flex items-center gap-3.5 border-b border-[#EFE9DE] bg-[#FBF8F2] px-[22px] py-[13px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A7E74]">
              <span className="flex-1">Customer</span>
              <span className="w-[130px]">Phone</span>
              <span className="w-[70px] text-center">Orders</span>
              <span className="w-[110px] text-right">Lifetime</span>
              <span className="w-[70px] text-center">Reviews</span>
              <span className="w-[120px]">Last order</span>
              <span className="w-[110px] text-center">Standing</span>
            </div>

            {page.rows.length === 0 ? (
              <p className="px-[22px] py-[50px] text-center text-[13px] text-[#A99C90]">
                {page.search
                  ? "No customers match this search."
                  : "No customers yet — they appear here once an order is placed."}
              </p>
            ) : (
              page.rows.map((c) => (
                <CustomerRow
                  key={c.userId}
                  customer={c}
                  href={hrefFor({ customer: c.userId })}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <AdminPager
        page={page.page}
        pageCount={page.pageCount}
        total={page.total}
        pageSize={CUSTOMERS_PAGE_SIZE}
        hrefForPage={(n) => hrefFor({ page: String(n) })}
      />
    </div>
  )
}

function CustomerRow({ customer, href }: { customer: AdminCustomerRow; href: string }) {
  const router = useRouter()
  const chip = customerChip(customer.orderCount, customer.cancelledCount)

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="flex w-full items-center gap-3.5 border-b border-[#F3EEE4] px-[22px] py-[15px] text-left transition-colors last:border-b-0 hover:bg-[#FBF8F2]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-[#2A1F1A]">
          {customer.name}
        </span>
        <span className="mt-[3px] block truncate text-[11px] text-[#A99C90]">{customer.email}</span>
      </span>
      <span className="w-[130px] text-[12.5px] text-[#5E4A40]">{customer.phone}</span>
      <span className="w-[70px] text-center text-[13px] text-[#5E4A40]">
        {customer.orderCount}
      </span>
      <span className="w-[110px] text-right text-[13px] font-semibold text-[#2A1F1A]">
        {formatPaise(customer.lifetimePaise)}
      </span>
      <span className="w-[70px] text-center text-[13px] text-[#5E4A40]">
        {customer.reviewCount > 0 ? (
          <>
            {customer.reviewCount}
            <span className="text-[11px] text-[#A99C90]"> · ★{customer.avgRating}</span>
          </>
        ) : (
          <span className="text-[#C3B8AC]">—</span>
        )}
      </span>
      <span className="w-[120px] text-[12px] text-[#8A7E74]">{customer.lastOrderLabel}</span>
      <span className="flex w-[110px] justify-center">
        {chip ? (
          <span
            className="rounded-full px-2.5 py-[5px] text-[11px] font-semibold"
            style={{ color: chip.color, background: chip.bg }}
          >
            {chip.label}
          </span>
        ) : (
          <span className="text-[12px] text-[#C3B8AC]">—</span>
        )}
      </span>
    </button>
  )
}

import Link from "next/link"
import { averageOrderPaise, cancellationRate, customerChip } from "@/lib/admin/customers"
import type { CustomerOrder, CustomerOrderItem } from "@/lib/admin/customers"
import { statusChip } from "@/lib/admin/order-status"
import type { AdminCustomerDetail } from "@/lib/db/admin-customers"
import { ROUTES } from "@/lib/routes"
import { formatPaise } from "@/lib/utils/money"

/**
 * One customer's analytics + full history (11.4), styled as the analytics
 * detail's sibling: a back link, an identity header, stat cards, then the order
 * history with each line's review inline.
 */
export function CustomerDetail({
  detail,
  backHref,
}: {
  detail: AdminCustomerDetail
  backHref: string
}) {
  const { customer, orders } = detail
  const chip = customerChip(customer.orderCount, customer.cancelledCount)
  const aov = averageOrderPaise(
    customer.lifetimePaise,
    customer.orderCount,
    customer.cancelledCount,
  )

  return (
    <div className="flex flex-col gap-[18px]">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-maroon-700 hover:underline"
      >
        ‹ All customers
      </Link>

      {/* Identity */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[#EAE3D7] bg-white px-[22px] py-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="m-0 font-heading text-[24px] leading-none text-[#2A1F1A]">
              {customer.name}
            </h2>
            {chip && (
              <span
                className="rounded-full px-2.5 py-[5px] text-[11px] font-semibold"
                style={{ color: chip.color, background: chip.bg }}
              >
                {chip.label}
              </span>
            )}
          </div>
          <span className="break-words text-[12.5px] text-[#5E4A40]">
            {customer.phone} · {customer.email}
          </span>
          <span className="text-[11.5px] text-[#A99C90]">
            First order {customer.firstOrderLabel} · Last order {customer.lastOrderLabel}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Lifetime spend" value={formatPaise(customer.lifetimePaise)} />
        <Stat label="Orders" value={String(customer.orderCount)} />
        <Stat label="Average order" value={formatPaise(aov)} />
        <Stat
          label="Cancellation rate"
          value={`${cancellationRate(customer.orderCount, customer.cancelledCount)}%`}
          note={
            customer.cancelledCount > 0 ? `${customer.cancelledCount} cancelled` : "None cancelled"
          }
        />
        <Stat
          label="Reviews written"
          value={String(customer.reviewCount)}
          note={customer.avgRating != null ? `★ ${customer.avgRating} average` : "No ratings yet"}
        />
      </div>

      {/* Order history */}
      <section className="flex flex-col gap-3">
        <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A99C90]">
          Order history
        </h3>
        {orders.length === 0 ? (
          <p className="rounded-xl border border-[#EAE3D7] bg-white px-[22px] py-[50px] text-center text-[13px] text-[#A99C90]">
            No orders found for this customer.
          </p>
        ) : (
          orders.map((order) => <OrderCard key={order.orderNo} order={order} />)
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-[#EAE3D7] bg-white px-4 py-[18px]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A99C90]">
        {label}
      </span>
      <span className="font-heading text-[22px] leading-none text-[#2A1F1A]">{value}</span>
      {note && <span className="text-[11px] text-[#A99C90]">{note}</span>}
    </div>
  )
}

function OrderCard({ order }: { order: CustomerOrder }) {
  const chip = statusChip(order.status)

  return (
    <div className="overflow-clip rounded-xl border border-[#EAE3D7] bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#F0EADF] bg-[#FBF8F2] px-[18px] py-3">
        <Link
          href={`${ROUTES.adminOrders}?search=${encodeURIComponent(order.orderNo)}`}
          className="text-[13px] font-semibold text-maroon-700 hover:underline"
        >
          {order.orderNo}
        </Link>
        <span
          className="rounded-full px-2.5 py-[4px] text-[11px] font-semibold"
          style={{ color: chip.color, background: chip.bg }}
        >
          {chip.label}
        </span>
        <span className="text-[12px] text-[#8A7E74]">{order.dateLabel}</span>
        <span className="ml-auto text-[13px] font-semibold text-[#2A1F1A]">
          {formatPaise(order.totalPaise)}
        </span>
      </div>
      {order.items.map((item, i) => (
        <ItemRow key={`${item.name}-${i}`} item={item} />
      ))}
    </div>
  )
}

function ItemRow({ item }: { item: CustomerOrderItem }) {
  return (
    <div className="flex flex-col gap-2 border-b border-[#F5F0E7] px-[18px] py-3 last:border-b-0">
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-[#2A1F1A]">
          {item.name}
          <span className="font-normal text-[#A99C90]"> ×{item.qty}</span>
        </span>
        <span className="shrink-0 text-[13px] text-[#5E4A40]">
          {formatPaise(item.lineTotalPaise)}
        </span>
      </div>

      {item.review ? (
        <div className="rounded-[8px] border border-[#EFE3D0] bg-[#FDFBF6] px-3 py-2.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[12px] font-semibold text-gold-600">
              {"★".repeat(item.review.rating)}
              <span className="text-[#D6C9B4]">{"★".repeat(5 - item.review.rating)}</span>
            </span>
            {item.review.title && (
              <span className="text-[12.5px] font-semibold text-[#2A1F1A]">
                {item.review.title}
              </span>
            )}
            <span className="text-[11px] text-[#A99C90]">{item.review.dateLabel}</span>
          </div>
          {item.review.body && (
            <p className="m-0 mt-1 text-[12px] leading-relaxed text-[#5E4A40]">
              {item.review.body}
            </p>
          )}
        </div>
      ) : item.reviewedOnOrderNo ? (
        // A review is per (product, user) with no order link, so it is shown
        // once — against the earliest order containing the piece.
        <span className="text-[11.5px] text-[#A99C90]">
          Reviewed on {item.reviewedOnOrderNo}
        </span>
      ) : (
        <span className="text-[11.5px] text-[#C3B8AC]">No review yet</span>
      )}
    </div>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { listMyOrders, type MyOrderSummary } from "@/lib/db/orders"
import { getCurrentUser } from "@/lib/db/server"
import { ROUTES } from "@/lib/routes"
import { formatPaise } from "@/lib/utils/money"

export const metadata: Metadata = {
  title: "My Orders",
  robots: { index: false },
}

/**
 * Order history for the signed-in customer (rows come through the "customer
 * reads own orders" RLS policy). Each order links to its confirmation page.
 */
export default async function MyOrdersPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect(`${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.accountOrders)}`)
  }

  const orders = await listMyOrders()

  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-6 py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 font-heading text-[32px] font-semibold leading-tight text-maroon-900">
          My Orders
        </h1>
        <Link
          href={ROUTES.account}
          className="text-[13px] font-medium text-maroon-700 underline-offset-4 hover:underline"
        >
          ← Account details
        </Link>
      </header>

      {orders.length === 0 ? (
        <div className="flex flex-col items-start gap-5 rounded border border-[#E7D9C2] bg-[#FFFDF8] p-8">
          <p className="m-0 text-[14px] font-light text-[#5E4A44]">
            No orders yet — your orders will appear here once you&apos;ve checked out.
          </p>
          <Link
            href={ROUTES.shop}
            className="rounded-sm bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-6 py-3.5 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#3A0E18] shadow-[0_10px_24px_rgba(168,122,30,0.28)] transition-[filter] hover:brightness-105"
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {orders.map((order) => (
            <OrderRow key={order.orderNo} order={order} />
          ))}
        </ul>
      )}
    </main>
  )
}

function OrderRow({ order }: { order: MyOrderSummary }) {
  const placedOn = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return (
    <li>
      <Link
        href={ROUTES.accountOrder(order.orderNo)}
        className="flex flex-wrap items-center justify-between gap-4 rounded border border-[#E7D9C2] bg-[#FFFDF8] px-6 py-5 transition-colors hover:border-gold-400"
      >
        <span className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold leading-none text-maroon-700">
            {order.orderNo}
          </span>
          <span className="text-[12.5px] font-light leading-none text-[#5E4A44]">
            {placedOn} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
          </span>
        </span>
        <span className="flex items-center gap-4">
          <StatusChip status={order.status} />
          <span className="text-[15px] font-semibold leading-none text-maroon-900">
            {formatPaise(order.totalPaise)}
          </span>
        </span>
      </Link>
    </li>
  )
}

/** Status chip tones, matched to the admin prototype's order chips. */
const STATUS_CHIP_CLASSES: Record<string, string> = {
  Pending: "bg-[#FBF1DD] text-[#8A6A1F]",
  Paid: "bg-[#E4F3E7] text-[#1E7A38]",
  Packed: "bg-[#FBF1DD] text-[#8A6A1F]",
  Shipped: "bg-[#E3EDFB] text-[#2A5DA8]",
  Delivered: "bg-[#E4F3E7] text-[#1E7A38]",
  Cancelled: "bg-[#FBEAEC] text-[#B23A48]",
}

function StatusChip({ status }: { status: string }) {
  const tone = STATUS_CHIP_CLASSES[status] ?? "bg-[#F3E9E2] text-[#5E4A44]"
  return (
    <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold leading-none ${tone}`}>
      {status}
    </span>
  )
}

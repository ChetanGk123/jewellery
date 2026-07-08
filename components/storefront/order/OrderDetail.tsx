import Link from "next/link"
import type { MyOrderDetail } from "@/lib/db/orders"
import { buildStepper, statusChip, type OrderStep, type StepState } from "@/lib/admin/order-status"
import { ROUTES } from "@/lib/routes"
import { formatPaise } from "@/lib/utils/money"
import { CancelOrderButton } from "./CancelOrderButton"

type Props = {
  order: MyOrderDetail
}

/**
 * Signed-in order detail (TASKS 4.14): status timeline, items, delivery
 * address, totals, and a cancel-while-Pending action. Reuses the shared
 * fulfilment-flow logic from `lib/admin/order-status.ts` (the same rules the
 * `admin_set_order_status`/`customer_cancel_order` RPCs enforce) but renders
 * it in the storefront's maroon/gold/cream chrome rather than the admin
 * console's palette.
 */
export function OrderDetail({ order }: Props) {
  const chip = statusChip(order.status)
  const steps = buildStepper(order.status)
  const placedOn = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return (
    <main className="mx-auto w-full max-w-[760px] flex-1 px-6 py-12">
      <Link
        href={ROUTES.accountOrders}
        className="mb-6 inline-block text-[13px] font-medium text-maroon-700 underline-offset-4 hover:underline"
      >
        ← My Orders
      </Link>

      <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-[#E7D9C2] pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-heading text-[28px] font-semibold leading-tight text-maroon-900">
            {order.orderNo}
          </h1>
          <span className="text-[12.5px] font-light leading-none text-[#5E4A44]">
            Placed on {placedOn}
          </span>
        </div>
        <span
          className="rounded-full px-3.5 py-2 text-[12px] font-semibold leading-none"
          style={{ color: chip.color, background: chip.bg }}
        >
          {chip.label}
        </span>
      </header>

      {steps ? (
        <Stepper steps={steps} />
      ) : (
        <p className="mb-7 rounded border border-[#E0B7B2] bg-[#FBEAEC] px-5 py-4 text-center text-[13px] font-medium text-[#B23A48]">
          This order was cancelled.
        </p>
      )}

      <div className="mt-7 flex flex-col gap-5">
        <Card title="Items">
          <div className="flex flex-col">
            {order.items.map((item, i) => (
              <div
                key={`${item.name}-${i}`}
                className="flex items-center gap-3 border-b border-[#F5EFE4] py-3 last:border-b-0"
              >
                <span className="flex-1 text-[13.5px] font-medium leading-snug text-maroon-900">
                  {item.name}
                  {item.tone && <span className="font-normal text-[#9C8A84]"> · {item.tone}</span>}
                  <span className="font-normal text-[#9C8A84]"> ×{item.qty}</span>
                </span>
                <span className="text-[13.5px] font-semibold text-maroon-900">
                  {formatPaise(item.lineTotalPaise)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 border-t border-[#F5EFE4] pt-3">
            <Row label="Subtotal" value={formatPaise(order.subtotalPaise)} />
            {order.discountPaise > 0 && (
              <Row label="Discount" value={`− ${formatPaise(order.discountPaise)}`} />
            )}
            <Row
              label="Shipping"
              value={order.shippingPaise === 0 ? "Free" : formatPaise(order.shippingPaise)}
            />
            <div className="flex items-baseline justify-between border-t border-[#F5EFE4] pt-2">
              <span className="text-[14px] font-semibold text-maroon-900">Total</span>
              <span className="text-[18px] font-semibold text-maroon-700">
                {formatPaise(order.totalPaise)}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Delivery Address">
          <span className="text-[13.5px] font-medium leading-snug text-maroon-900">
            {order.customerName}
          </span>
          <span className="text-[12.5px] leading-relaxed text-[#5E4A44]">
            {order.customerPhone} · {order.customerEmail}
          </span>
          <span className="text-[12.5px] leading-relaxed text-[#5E4A44]">
            {order.addressLine}, {order.city}, {order.state} — {order.pincode}
          </span>
        </Card>

        {order.status === "Pending" && <CancelOrderButton orderNo={order.orderNo} />}
      </div>
    </main>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded border border-[#E7D9C2] bg-[#FFFDF8] p-5">
      <span className="mb-1 text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-gold-600">
        {title}
      </span>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13px] leading-none text-[#5E4A44]">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

const STEP_STYLES: Record<
  StepState,
  { dot: string; mark: string; markColor: string; label: string }
> = {
  done: { dot: "#C9A24B", mark: "✓", markColor: "#FFFFFF", label: "#4A0E1C" },
  active: { dot: "#71182B", mark: "●", markColor: "#F3E3C7", label: "#71182B" },
  upcoming: { dot: "#F3E9E2", mark: "", markColor: "#9C8A84", label: "#9C8A84" },
}

/** Fulfilment stepper, restyled from `OrderDrawer`'s admin version for storefront chrome. */
function Stepper({ steps }: { steps: OrderStep[] }) {
  return (
    <div className="mb-7 flex items-center">
      {steps.map((step, i) => {
        const s = STEP_STYLES[step.state]
        const isLast = i === steps.length - 1
        return (
          <div key={step.label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold leading-none"
                style={{ background: s.dot, borderColor: s.dot, color: s.markColor }}
              >
                {s.mark}
              </span>
              <span
                className="whitespace-nowrap text-[9.5px] font-medium"
                style={{ color: s.label }}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <span
                className="mb-4 h-0.5 flex-1"
                style={{ background: step.state === "done" ? "#C9A24B" : "#EFE3D0" }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

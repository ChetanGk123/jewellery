import type { MyReturnRequest } from "@/lib/db/orders"
import { returnStatusChip } from "@/lib/returns"
import { formatPaise } from "@/lib/utils/money"

type Props = {
  returnRequest: MyReturnRequest
  /** Who-pays-shipping note from the store's returns settings (for Approved). */
  shippingNote: string
}

/** What each return state means for the customer, in their language. */
const STATUS_COPY: Record<string, string> = {
  Requested: "We've received your return request and are reviewing it — you'll hear from us soon.",
  Approved: "Your return is approved. Pack the piece securely with all packaging.",
  Received: "The item has reached us and is being inspected — refunds/exchanges follow shortly.",
  Refunded: "Your refund has been paid to your UPI ID.",
  Exchanged: "Your exchange is confirmed — the replacement piece is on its way.",
  Rejected: "We couldn't accept this return request.",
}

/**
 * The order's return request on the customer order page (TASKS 8.7c) — the
 * sibling of the fulfilment stepper for the returns flow. Shows the state
 * chip, what it means, and the settlement details once they exist.
 */
export function ReturnStatusCard({ returnRequest, shippingNote }: Props) {
  const chip = returnStatusChip(returnRequest.status)
  const requestedOn = new Date(returnRequest.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return (
    <div className="flex flex-col gap-2.5 rounded border border-[#E7D9C2] bg-[#FFFDF8] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-gold-600">
          Return
        </span>
        <span
          className="rounded-full px-3 py-1.5 text-[11px] font-semibold leading-none"
          style={{ color: chip.color, background: chip.bg }}
        >
          {chip.label}
        </span>
      </div>

      <span className="text-[12.5px] leading-relaxed text-[#5E4A44]">
        Requested on {requestedOn} ·{" "}
        {returnRequest.resolution === "refund"
          ? `Refund to ${returnRequest.upiId ?? "your UPI ID"}`
          : "Exchange"}
      </span>

      <p className="m-0 text-[13px] leading-relaxed text-maroon-900">
        {STATUS_COPY[returnRequest.status] ?? ""}
      </p>

      {returnRequest.status === "Approved" && (
        <p className="m-0 rounded-sm bg-[#FBF6EE] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#5E4A44]">
          {shippingNote}
        </p>
      )}

      {returnRequest.status === "Refunded" && returnRequest.refundAmountPaise !== null && (
        <div className="flex flex-col gap-1 rounded-sm bg-[#E7F3EB] px-3.5 py-2.5">
          <span className="text-[13px] font-semibold text-[#1B7A3D]">
            {formatPaise(returnRequest.refundAmountPaise)} refunded
          </span>
          {returnRequest.refundReference && (
            <span className="text-[11.5px] text-[#4A6B54]">
              UPI reference: {returnRequest.refundReference}
            </span>
          )}
        </div>
      )}

      {returnRequest.status === "Rejected" && returnRequest.adminNote && (
        <p className="m-0 rounded-sm bg-[#FBEAEC] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#8A2E3A]">
          {returnRequest.adminNote}
        </p>
      )}
    </div>
  )
}

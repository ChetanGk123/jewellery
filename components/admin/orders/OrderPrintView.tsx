import Link from "next/link"
import type { PrintDoc } from "@/lib/admin/print"
import type { AdminOrderRow } from "@/lib/db/admin-orders"
import type { StoreSettings } from "@/lib/db/settings"
import { ROUTES } from "@/lib/routes"
import type { ResolvedStoreInfo } from "@/lib/store-info"
import { formatPaise } from "@/lib/utils/money"
import { PrintButton } from "./PrintButton"

/**
 * Print surface for one order (TASKS 5.12): renders **one** document per visit —
 * the invoice or the packing slip, selected by `doc` (`?doc=` on the route) — so
 * each can be printed independently. Server component — the only client island
 * is the Print button. Styled for paper: white ground, black-ish ink, hairline
 * tables; the on-screen toolbar (with a cross-link to the other document) is
 * `print:hidden`.
 *
 * Honesty rules: the document is titled **TAX INVOICE only when a GSTIN is
 * configured** (Settings → Store Information); otherwise it's an "INVOICE" and
 * the GSTIN row is omitted. Prices are stored tax-inclusive, so totals carry an
 * "inclusive of all applicable taxes" note rather than a fabricated CGST/SGST
 * split (a real break-up needs the store's GST rate — follow-up once GSTIN lands).
 */
export function OrderPrintView({
  order,
  settings,
  info,
  doc,
}: {
  order: AdminOrderRow
  settings: StoreSettings
  /** Resolved store identity — the invoice/slip seller block (6.15). */
  info: ResolvedStoreInfo
  doc: PrintDoc
}) {
  const isCancelled = order.status === "Cancelled"
  const isDelivered = order.status === "Delivered"
  const codOutstanding = order.paymentMethod === "cod" && !isCancelled && !isDelivered
  const otherDoc: PrintDoc = doc === "invoice" ? "packing-slip" : "invoice"

  return (
    <div className="mx-auto flex min-h-screen max-w-[760px] flex-col gap-6 bg-white px-8 py-6 font-body text-[#1F1712] print:max-w-none print:gap-0 print:p-0">
      {/* On-screen toolbar — never printed */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#EAE3D7] bg-[#FBF8F2] px-4 py-3 print:hidden">
        <Link
          href={ROUTES.adminOrders}
          className="text-[12.5px] font-medium text-maroon-700 hover:underline"
        >
          ← Back to orders
        </Link>
        <Link
          href={ROUTES.adminOrderPrint(order.orderNo, otherDoc)}
          className="text-[12.5px] font-medium text-maroon-700 hover:underline"
        >
          {doc === "invoice" ? "Switch to packing slip →" : "Switch to invoice →"}
        </Link>
        <PrintButton />
      </div>

      {doc === "invoice" ? (
        <InvoiceDocument
          order={order}
          settings={settings}
          info={info}
          isCancelled={isCancelled}
          codOutstanding={codOutstanding}
        />
      ) : (
        <PackingSlipDocument order={order} info={info} codOutstanding={codOutstanding} />
      )}
    </div>
  )
}

/* -------------------------------- Invoice -------------------------------- */

function InvoiceDocument({
  order,
  settings,
  info,
  isCancelled,
  codOutstanding,
}: {
  order: AdminOrderRow
  settings: StoreSettings
  info: ResolvedStoreInfo
  isCancelled: boolean
  codOutstanding: boolean
}) {
  return (
    <section>
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#1F1712] pb-4">
        <div>
          <div className="font-display text-[22px] tracking-[0.08em]">{info.wordmark}</div>
          <div className="mt-0.5 text-[11.5px] text-[#5E4A40]">{info.descriptor}</div>
          <div className="mt-2 text-[11.5px] leading-relaxed text-[#5E4A40]">
            {info.address.line}
            <br />
            {info.phone.display} · {info.email.display}
            {settings.gstin && (
              <>
                <br />
                <span className="font-semibold text-[#1F1712]">GSTIN: {settings.gstin}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[16px] font-semibold tracking-[0.12em]">
            {settings.gstin ? "TAX INVOICE" : "INVOICE"}
          </div>
          <div className="mt-2 text-[11.5px] leading-relaxed text-[#5E4A40]">
            Invoice no: <span className="font-semibold text-[#1F1712]">{order.orderNo}</span>
            <br />
            Date: {order.dateLabel}
            <br />
            Payment: {order.paymentLabel}
          </div>
          {isCancelled && (
            <div className="mt-2 inline-block border border-[#C0392F] px-2 py-1 text-[11px] font-semibold tracking-[0.1em] text-[#C0392F]">
              CANCELLED
            </div>
          )}
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <AddressBlock label="Bill to" order={order} />
        <AddressBlock label="Ship to" order={order} />
      </div>

      <table className="mt-5 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[#1F1712] text-left text-[10.5px] uppercase tracking-[0.08em] text-[#5E4A40]">
            <th className="py-2 pr-2 font-semibold">#</th>
            <th className="py-2 pr-2 font-semibold">Item</th>
            <th className="py-2 pr-2 text-center font-semibold">Qty</th>
            <th className="py-2 pr-2 text-right font-semibold">Unit price</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={`${it.name}-${i}`} className="border-b border-[#E5DED2]">
              <td className="py-2.5 pr-2 align-top text-[#5E4A40]">{i + 1}</td>
              <td className="py-2.5 pr-2 align-top">
                <span className="font-medium">{it.name}</span>
                {it.tone && <span className="text-[#5E4A40]"> · {it.tone} plating</span>}
              </td>
              <td className="py-2.5 pr-2 text-center align-top">{it.qty}</td>
              <td className="py-2.5 pr-2 text-right align-top">
                {formatPaise(Math.round(it.lineTotalPaise / it.qty))}
              </td>
              <td className="py-2.5 text-right align-top font-medium">
                {formatPaise(it.lineTotalPaise)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-[260px] text-[12px]">
        <TotalRow label="Subtotal" value={formatPaise(order.subtotalPaise)} />
        {order.discountPaise > 0 && (
          <TotalRow label="Discount" value={`− ${formatPaise(order.discountPaise)}`} />
        )}
        <TotalRow
          label="Shipping"
          value={order.shippingPaise === 0 ? "Free" : formatPaise(order.shippingPaise)}
        />
        <div className="mt-1 flex items-baseline justify-between border-t-2 border-[#1F1712] pt-2">
          <span className="text-[13px] font-semibold">Grand total</span>
          <span className="text-[16px] font-semibold">{formatPaise(order.totalPaise)}</span>
        </div>
        <p className="mt-1 text-right text-[10.5px] text-[#5E4A40]">
          Inclusive of all applicable taxes.
        </p>
      </div>

      <p className="mt-5 text-[11px] text-[#5E4A40]">
        {codOutstanding
          ? `Cash on Delivery — ${formatPaise(order.totalPaise)} payable at delivery.`
          : isCancelled
            ? "This order was cancelled; no amount is payable."
            : "Paid by Cash on Delivery."}
      </p>
      <p className="mt-6 border-t border-[#E5DED2] pt-3 text-[10.5px] text-[#8A7E74]">
        This is a computer-generated invoice from {info.name} and needs no signature. Questions?{" "}
        {info.email.display} · {info.phone.display}
      </p>
    </section>
  )
}

/* ------------------------------ Packing slip ------------------------------ */

function PackingSlipDocument({
  order,
  info,
  codOutstanding,
}: {
  order: AdminOrderRow
  info: ResolvedStoreInfo
  codOutstanding: boolean
}) {
  return (
    <section>
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#1F1712] pb-4">
        <div>
          <div className="font-display text-[22px] tracking-[0.08em]">{info.wordmark}</div>
          <div className="mt-0.5 text-[11.5px] text-[#5E4A40]">
            {info.address.line} · {info.phone.display}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[16px] font-semibold tracking-[0.12em]">PACKING SLIP</div>
          <div className="mt-2 text-[11.5px] text-[#5E4A40]">
            Order: <span className="font-semibold text-[#1F1712]">{order.orderNo}</span>
            <br />
            Date: {order.dateLabel}
          </div>
        </div>
      </header>

      {/* Big ship-to block — this face goes on the parcel */}
      <div className="mt-5 border-2 border-[#1F1712] p-4">
        <div className="text-[10.5px] uppercase tracking-[0.1em] text-[#5E4A40]">Deliver to</div>
        <div className="mt-1.5 text-[17px] font-semibold leading-snug">{order.customerName}</div>
        <div className="mt-1 text-[14px] leading-relaxed">
          {order.addressLine}
          <br />
          {order.city}, {order.state} — {order.pincode}
        </div>
        <div className="mt-1.5 text-[13px]">☎ {order.phone}</div>
        {codOutstanding && (
          <div className="mt-3 inline-block border-2 border-[#1F1712] px-3 py-1.5 text-[13px] font-bold tracking-[0.04em]">
            COD — COLLECT {formatPaise(order.totalPaise)}
          </div>
        )}
      </div>

      <table className="mt-5 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-[#1F1712] text-left text-[10.5px] uppercase tracking-[0.08em] text-[#5E4A40]">
            <th className="py-2 pr-2 font-semibold">#</th>
            <th className="py-2 pr-2 font-semibold">Item</th>
            <th className="py-2 text-center font-semibold">Qty</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={`${it.name}-${i}`} className="border-b border-[#E5DED2]">
              <td className="py-2.5 pr-2 text-[#5E4A40]">{i + 1}</td>
              <td className="py-2.5 pr-2">
                <span className="font-medium">{it.name}</span>
                {it.tone && <span className="text-[#5E4A40]"> · {it.tone} plating</span>}
              </td>
              <td className="py-2.5 text-center font-medium">{it.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-right text-[12px] font-semibold">
        {order.itemCount} item{order.itemCount === 1 ? "" : "s"} in this parcel
      </p>

      <p className="mt-6 border-t border-[#E5DED2] pt-3 text-[10.5px] text-[#8A7E74]">
        Fragile — jewellery, handle with care. Packed by {info.name}.
      </p>
    </section>
  )
}

/* -------------------------------- Helpers -------------------------------- */

function AddressBlock({ label, order }: { label: string; order: AdminOrderRow }) {
  return (
    <div className="text-[12px] leading-relaxed">
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-[#5E4A40]">{label}</div>
      <div className="mt-1 font-semibold">{order.customerName}</div>
      <div>
        {order.addressLine}
        <br />
        {order.city}, {order.state} — {order.pincode}
      </div>
      <div className="mt-0.5 text-[#5E4A40]">
        {order.phone} · {order.email}
      </div>
    </div>
  )
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-[#5E4A40]">
      <span>{label}</span>
      <span className="text-[#1F1712]">{value}</span>
    </div>
  )
}

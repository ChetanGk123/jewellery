"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { addOrderNote, setOrderAwb } from "@/app/(admin)/admin/(console)/orders/actions"
import type { AdminOrderItem, AdminOrderRow, OrderEvent } from "@/lib/db/admin-orders"
import { AWB_MAX_LEN, TRACKING_URL_MAX_LEN, showAwbCard } from "@/lib/admin/awb"
import { NOTE_MAX_LEN } from "@/lib/admin/order-notes"
import {
  advanceLabel,
  buildStepper,
  canCancel,
  prevStatus,
  showPrintActions,
  statusChip,
  type OrderStep,
  type StepState,
} from "@/lib/admin/order-status"
import { useDialog } from "@/hooks/useDialog"
import type { PrintDoc } from "@/lib/admin/print"
import { ROUTES } from "@/lib/routes"
import { PLACEHOLDER_GRADIENT } from "@/lib/theme"
import { formatPaise } from "@/lib/utils/money"
import { codConfirmationMessage, customerWhatsappUrl } from "@/lib/whatsapp"

type Props = {
  order: AdminOrderRow | null
  isOpen: boolean
  onClose: () => void
  onAdvance: () => void
  /** Undo a mis-click: move one step back along the flow (6.5). */
  onMoveBack: () => void
  onCancel: () => void
  /** A note was saved — parent appends it to its drawer snapshot (5.16). */
  onNoteAdded: (event: OrderEvent) => void
  /** The AWB (+ optional tracking link) was saved — parent updates its drawer snapshot (6.4). */
  onAwbSaved: (awb: string, trackingUrl: string | null) => void
  isPending: boolean
  error: string | null
}

/**
 * Right-hand fulfilment drawer (prototype-matched). Slides in over a backdrop;
 * shows the status stepper, customer + address, item lines with totals, the
 * timeline + internal notes, the manual courier-AWB card, and the move-back /
 * advance / cancel actions. The parent owns the selection + the status action;
 * the note composer and AWB card are self-contained but report saves up via
 * `onNoteAdded` / `onAwbSaved` so the parent's snapshot stays current.
 */
export function OrderDrawer({
  order,
  isOpen,
  onClose,
  onAdvance,
  onMoveBack,
  onCancel,
  onNoteAdded,
  onAwbSaved,
  isPending,
  error,
}: Props) {
  const advance = order ? advanceLabel(order.status) : null
  const back = order ? prevStatus(order.status) : null
  const showCancel = order ? canCancel(order.status) : false
  const steps = order ? buildStepper(order.status) : null
  const dialogRef = useDialog<HTMLElement>({ isOpen, onDismiss: onClose, isPending })
  // Which print document is open in the in-app dialog (6.6); null = closed.
  const [printDoc, setPrintDoc] = useState<PrintDoc | null>(null)

  return (
    <>
      <button
        type="button"
        aria-label="Close order"
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
        className={`fixed inset-0 z-[60] bg-[rgba(42,10,18,0.45)] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={order ? `Order ${order.orderNo}` : "Order details"}
        aria-hidden={!isOpen}
        tabIndex={-1}
        className="fixed inset-y-0 right-0 z-[65] flex w-[440px] max-w-full flex-col bg-[#F5F1EA] shadow-[-12px_0_40px_rgba(42,10,18,0.22)] outline-none transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ transform: isOpen ? "translateX(0)" : "translateX(100%)" }}
      >
        {order && (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-[#E7E0D4] bg-white px-4 py-[18px] sm:px-6 sm:py-[22px]">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="break-words font-heading text-[20px] leading-tight text-[#2A1F1A] sm:text-[22px] sm:leading-none">
                  {order.orderNo}
                </span>
                <span className="text-[12px] text-[#8A7E74]">
                  {order.dateLabel} · {order.paymentLabel}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <StatusPill status={order.status} />
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="-m-1.5 p-1.5 text-[22px] leading-none text-[#8A7E74] hover:text-[#2A1F1A]"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-4 py-[22px] sm:px-6">
              {steps ? (
                <Stepper steps={steps} />
              ) : (
                <p className="rounded-[10px] border border-[#E0B7B2] bg-[#FBE9E7] px-4 py-3 text-center text-[12.5px] font-medium text-[#C0392F]">
                  This order was cancelled.
                </p>
              )}

              <Card label="Customer">
                <span className="text-[14px] font-medium text-[#2A1F1A]">{order.customerName}</span>
                <span className="text-[12px] font-medium text-[#8A7E74]">
                  {order.customerOrderCount <= 1
                    ? "First order from this customer"
                    : `${order.customerOrderCount} orders from this customer`}
                  {order.customerCancelledCount > 0 && (
                    <span className="text-[#C0392F]">
                      {" "}
                      · {order.customerCancelledCount} cancelled
                    </span>
                  )}
                  {/* Legacy seed orders carry no user_id, so there is no
                      customer record to open — the count stands alone. */}
                  {order.userId && (
                    <>
                      {" · "}
                      {/* Carries the phone as the list's search term so the
                          row is on page 1 and the detail resolves, however
                          many customers the store has. */}
                      <Link
                        href={`${ROUTES.adminCustomers}?search=${encodeURIComponent(order.phone)}&customer=${encodeURIComponent(order.userId)}`}
                        className="font-semibold text-maroon-700 underline underline-offset-2 hover:text-maroon-900"
                      >
                        View customer
                      </Link>
                    </>
                  )}
                </span>
                <span className="break-words text-[12.5px] leading-relaxed text-[#5E4A40]">
                  {order.phone} · {order.email}
                </span>
                <span className="break-words text-[12.5px] leading-relaxed text-[#5E4A40]">
                  {order.addressLine}, {order.city}, {order.state} — {order.pincode}
                </span>
                <ContactActions order={order} />
              </Card>

              {/* overflow-clip (not -hidden): clips the rows to the rounded
                  corners without making this a scroll container, which
                  collapsed the card inside the drawer's flex column. */}
              <div className="overflow-clip rounded-[10px] border border-[#EAE3D7] bg-white">
                <div className="border-b border-[#F0EADF] px-4 py-[13px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A99C90]">
                  Items
                </div>
                {order.items.map((it, i) => (
                  <ItemRow key={`${it.name}-${i}`} item={it} />
                ))}
                <div className="flex flex-col gap-2 px-4 py-3">
                  <Row label="Subtotal" value={formatPaise(order.subtotalPaise)} />
                  {/* Also renders on a redeemed code that happened to take ₹0
                      off, so the coupon is never invisible on the order. */}
                  {(order.discountPaise > 0 || order.couponCode) && (
                    <div className="flex items-baseline justify-between gap-3 text-[12.5px] text-[#5E4A40]">
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        Discount
                        {order.couponCode && (
                          <code className="truncate rounded bg-[#F3EEE4] px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-[#8A6D1E]">
                            {order.couponCode}
                          </code>
                        )}
                      </span>
                      <span className="shrink-0">− {formatPaise(order.discountPaise)}</span>
                    </div>
                  )}
                  <Row
                    label="Shipping"
                    value={order.shippingPaise === 0 ? "Free" : formatPaise(order.shippingPaise)}
                  />
                  <div className="flex items-baseline justify-between border-t border-[#F0EADF] pt-2">
                    <span className="text-[14px] font-semibold text-[#2A1F1A]">Total</span>
                    <span className="text-[18px] font-semibold text-maroon-700">
                      {formatPaise(order.totalPaise)}
                    </span>
                  </div>
                </div>
              </div>

              {/* min-w + wrap: stacks instead of clipping on narrow phones */}
              {showPrintActions(order.status) && (
                <div className="flex flex-wrap gap-2.5">
                  <PrintTrigger onClick={() => setPrintDoc("invoice")} label="Print invoice" />
                  <PrintTrigger
                    onClick={() => setPrintDoc("packing-slip")}
                    label="Print packing slip"
                  />
                </div>
              )}

              <Timeline order={order} onNoteAdded={onNoteAdded} />

              {/* Hidden until the parcel stage (6.4d); key resets the inputs
                  when a different order opens. */}
              {showAwbCard(order.status, order.awb) && (
                <AwbCard key={order.id} order={order} onAwbSaved={onAwbSaved} />
              )}
            </div>

            {(advance || back || showCancel) && (
              <footer className="flex flex-col gap-2 border-t border-[#E7E0D4] bg-white px-4 py-[18px] sm:px-6">
                {error && <p className="text-[12px] font-medium text-[#C0392F]">{error}</p>}
                <div className="flex flex-wrap gap-2.5">
                  {back && (
                    <button
                      type="button"
                      onClick={onMoveBack}
                      disabled={isPending}
                      title={`Move back to ${back} (undo a mis-click)`}
                      className="rounded-lg border border-[#DAD0C2] bg-white px-[14px] py-3.5 text-[12px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
                    >
                      ← {back}
                    </button>
                  )}
                  {advance && (
                    <button
                      type="button"
                      onClick={onAdvance}
                      disabled={isPending}
                      className="flex-1 rounded-lg bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] py-3.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#3A0E18] transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {isPending ? "Updating…" : advance}
                    </button>
                  )}
                  {showCancel && (
                    <button
                      type="button"
                      onClick={onCancel}
                      disabled={isPending}
                      className="rounded-lg border border-[#E0B7B2] bg-white px-[18px] py-3.5 text-[12px] font-semibold text-[#C0392F] transition-colors hover:bg-[#FBE9E7] disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </footer>
            )}
          </>
        )}
      </aside>

      {/* Sibling of the aside: its transform would trap a fixed dialog. */}
      {order && printDoc && (
        <PrintDialog orderNo={order.orderNo} doc={printDoc} onClose={() => setPrintDoc(null)} />
      )}
    </>
  )
}

function StatusPill({ status }: { status: string }) {
  const chip = statusChip(status)
  return (
    <span
      className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
      style={{ color: chip.color, background: chip.bg }}
    >
      {chip.label}
    </span>
  )
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-[#EAE3D7] bg-white p-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A99C90]">
        {label}
      </span>
      {children}
    </div>
  )
}

/**
 * One-click ways to reach the customer about this order (TASKS 5.15): Call
 * (`tel:`) and WhatsApp — prefilled with the COD-confirmation template while
 * the order is Pending COD (confirm before dispatch so parcels don't bounce),
 * else a neutral opener naming the order. WhatsApp hides on unusable numbers.
 */
function ContactActions({ order }: { order: AdminOrderRow }) {
  const message =
    order.paymentMethod === "cod" && order.status === "Pending"
      ? codConfirmationMessage({
          customerName: order.customerName,
          orderNo: order.orderNo,
          totalPaise: order.totalPaise,
        })
      : `Namaste ${order.customerName}, this is regarding your order ${order.orderNo}.`
  const waUrl = customerWhatsappUrl(order.phone, message)
  const base =
    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors"

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <a
        href={`tel:${order.phone}`}
        className={`${base} border-[#E7E0D4] bg-white text-[#5E4A40] hover:bg-[#FBF8F2]`}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2Z" />
        </svg>
        Call
      </a>
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} border-[#BFE3C8] bg-[#EAF6EE] text-[#128C4A] hover:bg-[#E0F1E6]`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.3-.4 0-.5.1-.7l.4-.5c.1-.2.2-.3.3-.5v-.5c0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s1 2.5 1.1 2.7c.1.2 1.9 3 4.7 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.4-.4Z" />
          </svg>
          WhatsApp
        </a>
      )}
    </div>
  )
}

/** Opens one printable document (invoice or packing slip) in the dialog. */
function PrintTrigger({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-[150px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#DAD0C2] bg-white py-3 text-[12px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2]"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v7H6z" />
      </svg>
      {label}
    </button>
  )
}

/**
 * In-app print preview (6.6): the auth-gated print route in a same-origin
 * iframe — its own toolbar (Print, switch document) works inside, so this
 * shell only hosts, offers a new-tab fallback, and dismisses. Rendered
 * outside the drawer's transformed aside so `fixed` positions correctly.
 */
function PrintDialog({
  orderNo,
  doc,
  onClose,
}: {
  orderNo: string
  doc: PrintDoc
  onClose: () => void
}) {
  const dialogRef = useDialog<HTMLDivElement>({ isOpen: true, onDismiss: onClose })
  const src = ROUTES.adminOrderPrint(orderNo, doc)
  const title = doc === "invoice" ? "Invoice" : "Packing slip"

  return (
    <>
      <button
        type="button"
        aria-label="Close print preview"
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-[rgba(42,10,18,0.5)]"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} for ${orderNo}`}
        tabIndex={-1}
        className="fixed inset-x-3 bottom-[4vh] top-[4vh] z-[75] mx-auto flex max-w-[860px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(42,10,18,0.35)] outline-none"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#E7E0D4] bg-white px-4 py-3">
          <span className="min-w-0 truncate text-[13px] font-semibold text-[#2A1F1A]">
            {title} · {orderNo}
          </span>
          <div className="flex shrink-0 items-center gap-4">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap text-[12px] font-semibold text-[#5E4A40] transition-colors hover:text-maroon-700"
            >
              Open in new tab
            </a>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="-m-1.5 p-1.5 text-[20px] leading-none text-[#8A7E74] hover:text-[#2A1F1A]"
            >
              ×
            </button>
          </div>
        </header>
        <iframe
          src={src}
          title={`${title} for ${orderNo}`}
          className="w-full flex-1 bg-[#F5F1EA]"
        />
      </div>
    </>
  )
}

/**
 * One ordered line: thumbnail, name/tone/qty, line total. Links to the
 * storefront product page in a new tab so the operator keeps the drawer open —
 * a plain row when the product has since been deleted (no slug to link to).
 */
function ItemRow({ item }: { item: AdminOrderItem }) {
  const body = (
    <>
      <span
        aria-hidden="true"
        className="h-11 w-11 flex-none rounded-lg border border-[#EFE3D0] bg-cover bg-center"
        style={{
          backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : PLACEHOLDER_GRADIENT,
        }}
      />
      <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-[#2A1F1A]">
        {item.name}
        {item.tone ? <span className="font-normal text-[#A99C90]"> · {item.tone}</span> : null}
        <span className="font-normal text-[#A99C90]"> ×{item.qty}</span>
      </span>
      <span className="text-[13px] font-semibold text-[#2A1F1A]">
        {formatPaise(item.lineTotalPaise)}
      </span>
    </>
  )

  const rowCls = "flex items-center gap-3 border-b border-[#F5F0E7] px-4 py-3"
  if (!item.slug) return <div className={rowCls}>{body}</div>

  return (
    <a
      href={ROUTES.product(item.slug)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${item.name} in a new tab`}
      className={`${rowCls} transition-colors hover:bg-[#FBF8F2] focus-visible:bg-[#FBF8F2] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#A87A1E]`}
    >
      {body}
    </a>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[12.5px] text-[#5E4A40]">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

/* -------------------------------- Stepper -------------------------------- */

const STEP_STYLES: Record<
  StepState,
  { dotBg: string; dotBorder: string; mark: string; markColor: string; label: string }
> = {
  done: {
    dotBg: "#C9A24B",
    dotBorder: "#C9A24B",
    mark: "✓",
    markColor: "#FFFFFF",
    label: "#2A1F1A",
  },
  active: {
    dotBg: "#71182B",
    dotBorder: "#71182B",
    mark: "●",
    markColor: "#F3E3C7",
    label: "#71182B",
  },
  upcoming: {
    dotBg: "#F3EEE4",
    dotBorder: "#E0D6C4",
    mark: "",
    markColor: "#A99C90",
    label: "#A99C90",
  },
}

function Stepper({ steps }: { steps: OrderStep[] }) {
  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const s = STEP_STYLES[step.state]
        const isLast = i === steps.length - 1
        return (
          <div key={step.label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold leading-none"
                style={{
                  background: s.dotBg,
                  borderColor: s.dotBorder,
                  color: s.markColor,
                }}
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
                style={{ background: step.state === "done" ? "#C9A24B" : "#EDE5D6" }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* --------------------------- Timeline + notes ---------------------------- */

const EVENT_DOTS: Record<OrderEvent["kind"], string> = {
  placed: "#C9A24B",
  status: "#71182B",
  note: "#A87A1E",
}

/**
 * Who/when history (TASKS 5.16): placement, admin status changes (from the 5.8
 * audit trail) and internal notes, oldest first, with the note composer below.
 * Customer self-cancels aren't audited, so they don't appear as entries — the
 * status pill and stepper still tell that story.
 */
function Timeline({
  order,
  onNoteAdded,
}: {
  order: AdminOrderRow
  onNoteAdded: (event: OrderEvent) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-[#EAE3D7] bg-white p-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A99C90]">
        Timeline &amp; notes
      </span>
      <ol className="flex flex-col">
        {order.events.map((event, i) => (
          <li key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                style={{ background: EVENT_DOTS[event.kind] }}
              />
              {i < order.events.length - 1 && <span className="w-px flex-1 bg-[#EDE5D6]" />}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 pb-3">
              {event.kind === "note" ? (
                <span className="whitespace-pre-line break-words rounded-md bg-[#FBF6EE] px-2.5 py-1.5 text-[12.5px] leading-relaxed text-[#5E4A40]">
                  {event.summary}
                </span>
              ) : (
                <span className="text-[12.5px] font-medium text-[#2A1F1A]">{event.summary}</span>
              )}
              <span className="text-[11px] text-[#A99C90]">
                {event.atLabel}
                {event.actorEmail && ` · ${event.actorEmail}`}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <NoteComposer orderNo={order.orderNo} onNoteAdded={onNoteAdded} />
    </div>
  )
}

/** Free-text internal note form — saves via the addOrderNote server action. */
function NoteComposer({
  orderNo,
  onNoteAdded,
}: {
  orderNo: string
  onNoteAdded: (event: OrderEvent) => void
}) {
  const [note, setNote] = useState("")
  const [noteError, setNoteError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const submit = () => {
    if (!note.trim() || isSaving) return
    startSaving(async () => {
      const res = await addOrderNote(orderNo, note)
      if (res.ok && res.event) {
        setNote("")
        setNoteError(null)
        onNoteAdded(res.event)
      } else {
        setNoteError(res.error ?? "Couldn't save the note.")
      }
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex flex-col gap-2 border-t border-[#F0EADF] pt-3"
    >
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={NOTE_MAX_LEN}
        rows={2}
        placeholder='Add an internal note — e.g. "deliver after 6pm"'
        aria-label="Internal note"
        className="resize-none rounded-md border border-[#E7E0D4] bg-[#FFFDF8] px-2.5 py-2 text-[12.5px] text-[#2A1F1A] outline-none placeholder:text-[#B7AB9E] focus:border-[#C9A24B]"
      />
      {noteError && <p className="text-[12px] font-medium text-[#C0392F]">{noteError}</p>}
      <button
        type="submit"
        disabled={isSaving || !note.trim()}
        className="self-end rounded-md border border-[#DAD0C2] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-50"
      >
        {isSaving ? "Saving…" : "Add note"}
      </button>
    </form>
  )
}

/* ----------------------------- Courier AWB ------------------------------- */

/**
 * Manual courier-AWB card (6.4) — replaces the old Shiprocket stub. Courier
 * integration stays deferred: the operator books the parcel outside the app
 * and records the tracking number here. The status RPC refuses the move into
 * Shipped until one is saved. Read-only once the order is terminal.
 */
function AwbCard({
  order,
  onAwbSaved,
}: {
  order: AdminOrderRow
  onAwbSaved: (awb: string, trackingUrl: string | null) => void
}) {
  const isLocked = order.status === "Delivered" || order.status === "Cancelled"
  const [value, setValue] = useState(order.awb ?? "")
  const [link, setLink] = useState(order.trackingUrl ?? "")
  const [awbError, setAwbError] = useState<string | null>(null)
  const [isSaving, startSaving] = useTransition()

  const isUnchanged =
    value.trim() === (order.awb ?? "") && link.trim() === (order.trackingUrl ?? "")

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed || isSaving) return
    startSaving(async () => {
      const res = await setOrderAwb(order.id, trimmed, link)
      if (res.ok && res.awb) {
        setAwbError(null)
        setValue(res.awb)
        setLink(res.trackingUrl ?? "")
        onAwbSaved(res.awb, res.trackingUrl ?? null)
      } else {
        setAwbError(res.error ?? "Couldn't save the AWB.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-[#EAE3D7] bg-white p-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A99C90]">
        Courier AWB &amp; tracking
      </span>
      {isLocked ? (
        <>
          <span
            className="text-[14px] font-medium"
            style={{ color: order.awb ? "#1B7A3D" : "#A99C90" }}
          >
            {order.awb ?? "Not recorded"}
          </span>
          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-[12px] text-[#5E4A40] underline underline-offset-2 hover:text-maroon-700"
            >
              {order.trackingUrl}
            </a>
          )}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="flex flex-col gap-2"
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={AWB_MAX_LEN}
            placeholder="AWB number, e.g. SR123456789"
            aria-label="Courier AWB number"
            className="rounded-md border border-[#E7E0D4] bg-[#FFFDF8] px-2.5 py-2 text-[12.5px] text-[#2A1F1A] outline-none placeholder:text-[#B7AB9E] focus:border-[#C9A24B]"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            type="url"
            maxLength={TRACKING_URL_MAX_LEN}
            placeholder="Tracking link (optional) — https://…"
            aria-label="Courier tracking link"
            className="rounded-md border border-[#E7E0D4] bg-[#FFFDF8] px-2.5 py-2 text-[12.5px] text-[#2A1F1A] outline-none placeholder:text-[#B7AB9E] focus:border-[#C9A24B]"
          />
          <button
            type="submit"
            disabled={isSaving || !value.trim() || isUnchanged}
            className="self-end rounded-md border border-[#DAD0C2] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-50"
          >
            {isSaving ? "Saving…" : order.awb ? "Update" : "Save"}
          </button>
        </form>
      )}
      {awbError && <p className="text-[12px] font-medium text-[#C0392F]">{awbError}</p>}
      {!isLocked && order.status === "Packed" && !order.awb && (
        <p className="text-[11.5px] text-[#A87A1E]">Required before marking this order Shipped.</p>
      )}
      {!isLocked && (
        <p className="text-[11px] text-[#A99C90]">
          The customer sees the AWB on their order page — with the link, it becomes clickable.
        </p>
      )}
    </div>
  )
}

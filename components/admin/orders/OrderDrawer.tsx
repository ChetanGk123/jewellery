"use client";

import type { AdminOrderRow } from "@/lib/db/admin-orders";
import {
  advanceLabel,
  buildStepper,
  canCancel,
  statusChip,
  type OrderStep,
  type StepState,
} from "@/lib/admin/order-status";
import { useDialog } from "@/hooks/useDialog";
import { formatPaise } from "@/lib/utils/money";

type Props = {
  order: AdminOrderRow | null;
  isOpen: boolean;
  onClose: () => void;
  onAdvance: () => void;
  onCancel: () => void;
  isPending: boolean;
  error: string | null;
};

/**
 * Right-hand fulfilment drawer (prototype-matched). Slides in over a backdrop;
 * shows the status stepper, customer + address, item lines with totals, a
 * Shiprocket AWB stub, and the advance / cancel actions. Purely presentational —
 * the parent owns the selection + the server action.
 */
export function OrderDrawer({
  order,
  isOpen,
  onClose,
  onAdvance,
  onCancel,
  isPending,
  error,
}: Props) {
  const advance = order ? advanceLabel(order.status) : null;
  const showCancel = order ? canCancel(order.status) : false;
  const steps = order ? buildStepper(order.status) : null;
  const dialogRef = useDialog<HTMLElement>({ isOpen, onDismiss: onClose, isPending });

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
            <header className="flex items-start justify-between border-b border-[#E7E0D4] bg-white px-6 py-[22px]">
              <div className="flex flex-col gap-1.5">
                <span className="font-heading text-[22px] leading-none text-[#2A1F1A]">
                  {order.orderNo}
                </span>
                <span className="text-[12px] text-[#8A7E74]">
                  {order.dateLabel} · {order.paymentLabel}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={order.status} />
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="text-[22px] leading-none text-[#8A7E74] hover:text-[#2A1F1A]"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-6 py-[22px]">
              {steps ? (
                <Stepper steps={steps} />
              ) : (
                <p className="rounded-[10px] border border-[#E0B7B2] bg-[#FBE9E7] px-4 py-3 text-center text-[12.5px] font-medium text-[#C0392F]">
                  This order was cancelled.
                </p>
              )}

              <Card label="Customer">
                <span className="text-[14px] font-medium text-[#2A1F1A]">
                  {order.customerName}
                </span>
                <span className="text-[12.5px] leading-relaxed text-[#5E4A40]">
                  {order.phone} · {order.email}
                </span>
                <span className="text-[12.5px] leading-relaxed text-[#5E4A40]">
                  {order.addressLine}, {order.city}, {order.state} — {order.pincode}
                </span>
              </Card>

              <div className="overflow-hidden rounded-[10px] border border-[#EAE3D7] bg-white">
                <div className="border-b border-[#F0EADF] px-4 py-[13px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A99C90]">
                  Items
                </div>
                {order.items.map((it, i) => (
                  <div
                    key={`${it.name}-${i}`}
                    className="flex items-center gap-3 border-b border-[#F5F0E7] px-4 py-3"
                  >
                    <span className="flex-1 text-[13px] font-medium leading-snug text-[#2A1F1A]">
                      {it.name}
                      {it.tone ? (
                        <span className="font-normal text-[#A99C90]"> · {it.tone}</span>
                      ) : null}
                      <span className="font-normal text-[#A99C90]"> ×{it.qty}</span>
                    </span>
                    <span className="text-[13px] font-semibold text-[#2A1F1A]">
                      {formatPaise(it.lineTotalPaise)}
                    </span>
                  </div>
                ))}
                <div className="flex flex-col gap-2 px-4 py-3">
                  <Row label="Subtotal" value={formatPaise(order.subtotalPaise)} />
                  {order.discountPaise > 0 && (
                    <Row
                      label="Discount"
                      value={`− ${formatPaise(order.discountPaise)}`}
                    />
                  )}
                  <Row
                    label="Shipping"
                    value={
                      order.shippingPaise === 0
                        ? "Free"
                        : formatPaise(order.shippingPaise)
                    }
                  />
                  <div className="flex items-baseline justify-between border-t border-[#F0EADF] pt-2">
                    <span className="text-[14px] font-semibold text-[#2A1F1A]">
                      Total
                    </span>
                    <span className="text-[18px] font-semibold text-maroon-700">
                      {formatPaise(order.totalPaise)}
                    </span>
                  </div>
                </div>
              </div>

              <AwbStub awb={order.awb} />
            </div>

            {(advance || showCancel) && (
              <footer className="flex flex-col gap-2 border-t border-[#E7E0D4] bg-white px-6 py-[18px]">
                {error && (
                  <p className="text-[12px] font-medium text-[#C0392F]">{error}</p>
                )}
                <div className="flex gap-2.5">
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
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  const chip = statusChip(status);
  return (
    <span
      className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
      style={{ color: chip.color, background: chip.bg }}
    >
      {chip.label}
    </span>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-[#EAE3D7] bg-white p-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A99C90]">
        {label}
      </span>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[12.5px] text-[#5E4A40]">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
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
};

function Stepper({ steps }: { steps: OrderStep[] }) {
  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const s = STEP_STYLES[step.state];
        const isLast = i === steps.length - 1;
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
        );
      })}
    </div>
  );
}

/* --------------------------- Shiprocket (stub) --------------------------- */

/**
 * Shiprocket AWB card — a deliberate stub. Real courier integration is deferred
 * (with Razorpay) to a later phase, so the actions render disabled with a
 * "coming soon" hint rather than pretending to work.
 */
function AwbStub({ awb }: { awb: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[#EAE3D7] bg-white p-4">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A99C90]">
          Shiprocket AWB
        </span>
        <div
          className="mt-1.5 text-[14px] font-medium"
          style={{ color: awb ? "#1B7A3D" : "#A99C90" }}
        >
          {awb ?? "Not generated yet"}
        </div>
      </div>
      <button
        type="button"
        disabled
        title="Shiprocket integration is coming in a later phase"
        className="cursor-not-allowed rounded-[7px] border border-[#CBD5E1] bg-white px-3.5 py-2.5 text-[11.5px] font-semibold text-[#94A3B8]"
      >
        {awb ? "Print Label" : "Generate AWB"}
      </button>
    </div>
  );
}

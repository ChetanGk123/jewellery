"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { setReturnStatus } from "@/app/(admin)/admin/(console)/returns/actions"
import type { AdminReturnRow, AdminReturnsData } from "@/lib/db/admin-returns"
import {
  RETURN_FILTERS,
  type ReturnFilter,
  returnStatusChip,
  type ReturnStatus,
} from "@/lib/returns"
import { ROUTES } from "@/lib/routes"
import { formatPaise } from "@/lib/utils/money"

/** Build a URL for a filter tab. Omits the default `Open`. */
function hrefFor(filter: ReturnFilter): string {
  return filter === "Open" ? ROUTES.adminReturns : `${ROUTES.adminReturns}?status=${filter}`
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
}

/**
 * Returns queue (TASKS 8.7d) — Open / Closed / All filter pills over the
 * return-request cards. Each open card carries the legal next moves
 * (Requested → Approve/Reject, Approved → Received, Received → Record refund /
 * Exchanged); the record-refund step captures the paid amount + UPI reference
 * so COD cash reconciles. Mirrors the ReviewsView card language.
 */
export function ReturnsView({ data }: { data: AdminReturnsData }) {
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap gap-2">
        {RETURN_FILTERS.map((tab) => {
          const active = data.filter === tab
          return (
            <Link
              key={tab}
              href={hrefFor(tab)}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-4 py-[9px] text-[12.5px] font-medium transition-colors ${
                active
                  ? "border-maroon-700 bg-maroon-700 text-cream-200"
                  : "border-[#EAE3D7] bg-white text-[#5E4A40] hover:border-[#D8CDB9]"
              }`}
            >
              {tab} <span className="opacity-70">{data.counts[tab]}</span>
            </Link>
          )
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-[#F0C8CE] bg-[#FBE9E7] px-3 py-2.5 font-body text-[12.5px] text-[#C0392F]">
          {error}
        </p>
      )}

      {data.rows.length === 0 ? (
        <p className="rounded-xl border border-[#EAE3D7] bg-white px-[22px] py-[50px] text-center font-body text-[13px] text-[#A99C90]">
          {data.filter === "Open"
            ? "No open return requests — nothing needs your attention."
            : "No return requests to show here yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.rows.map((row) => (
            <ReturnCard key={row.id} row={row} onError={setError} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReturnCard({ row, onError }: { row: AdminReturnRow; onError: (e: string) => void }) {
  const chip = returnStatusChip(row.status)
  const [note, setNote] = useState("")
  // Record-refund inputs, revealed on Received. Whole rupees (CLAUDE.md §2);
  // prefilled with the order total — the operator adjusts for deductions.
  const [isRecordingRefund, setIsRecordingRefund] = useState(false)
  const [amountRupees, setAmountRupees] = useState(String(Math.round(row.orderTotalPaise / 100)))
  const [reference, setReference] = useState("")
  const [isPending, startTransition] = useTransition()

  const move = (status: ReturnStatus, extra?: { amount?: number; reference?: string }) => {
    onError("")
    startTransition(async () => {
      const res = await setReturnStatus({
        id: row.id,
        status,
        refundAmountRupees: extra?.amount,
        refundReference: extra?.reference,
        note: note || undefined,
      })
      if (!res.ok) onError(res.error ?? "Couldn't update the return request.")
    })
  }

  const actionBase =
    "rounded-md border px-3.5 py-2.5 font-body text-[12px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-[#EAE3D7] bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-body text-[13px] font-semibold text-[#2A1F1A]">{row.orderNo}</span>
        <span
          className="shrink-0 rounded-full px-[9px] py-1 font-body text-[10.5px] font-semibold"
          style={{ color: chip.color, background: chip.bg }}
        >
          {chip.label}
        </span>
      </div>

      <div className="font-body text-[12px] text-[#A99C90]">
        {row.customerName} · {row.customerPhone} · requested {dateLabel(row.createdAt)}
      </div>

      <div className="flex flex-wrap items-center gap-2 font-body text-[12.5px] text-[#5E4A40]">
        <span className="rounded-md bg-[#FBF8F2] px-2.5 py-1.5 font-medium">
          {row.resolution === "refund" ? `Refund → ${row.upiId ?? "UPI"}` : "Exchange"}
        </span>
        <span className="rounded-md bg-[#FBF8F2] px-2.5 py-1.5">
          Order total {formatPaise(row.orderTotalPaise)}
        </span>
      </div>

      <p className="m-0 font-body text-[13px] font-light leading-[1.6] text-[#5E4A40]">
        {row.reason}
      </p>

      {row.photoUrls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {row.photoUrls.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              {/* Signed, short-lived URLs into the private bucket. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Return evidence ${i + 1} for ${row.orderNo}`}
                className="h-16 w-16 rounded-md border border-[#EAE3D7] object-cover transition-opacity hover:opacity-85"
              />
            </a>
          ))}
        </div>
      ) : (
        <p className="m-0 font-body text-[12px] italic text-[#A99C90]">
          Photos unavailable (signing failed — reload the page).
        </p>
      )}

      {row.status === "Refunded" && row.refundAmountPaise !== null && (
        <div className="rounded-md bg-[#E7F3EB] px-3 py-2 font-body text-[12.5px] text-[#15692F]">
          {formatPaise(row.refundAmountPaise)} refunded
          {row.refundReference ? ` · UTR ${row.refundReference}` : ""}
          {row.resolvedAt ? ` · ${dateLabel(row.resolvedAt)}` : ""}
        </div>
      )}
      {(row.status === "Exchanged" || row.status === "Rejected") && row.resolvedAt && (
        <div className="font-body text-[12px] text-[#A99C90]">
          {row.status} on {dateLabel(row.resolvedAt)}
        </div>
      )}
      {row.adminNote && (
        <div className="rounded-md bg-[#FBF8F2] px-3 py-2 font-body text-[12px] text-[#5E4A40]">
          Note: {row.adminNote}
        </div>
      )}

      {/* Legal next moves per state — the RPC re-checks regardless. */}
      {row.status === "Requested" && (
        <div className="flex flex-col gap-2">
          <NoteInput value={note} onChange={setNote} disabled={isPending} placeholder="Optional note (shown to the customer if rejected)" />
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => move("Approved")}
              disabled={isPending}
              className={`${actionBase} flex-1 border-[#BFE0C9] bg-[#E7F3EB] text-[#15692F]`}
            >
              ✓ Approve return
            </button>
            <button
              type="button"
              onClick={() => move("Rejected")}
              disabled={isPending}
              className={`${actionBase} flex-1 border-[#F0CBC6] bg-[#FBE9E7] text-[#C0392F]`}
            >
              × Reject
            </button>
          </div>
        </div>
      )}

      {row.status === "Approved" && (
        <button
          type="button"
          onClick={() => move("Received")}
          disabled={isPending}
          className={`${actionBase} self-start border-[#D8CBEE] bg-[#EFEAF9] text-[#7A5CB5]`}
        >
          Mark item received
        </button>
      )}

      {row.status === "Received" &&
        (isRecordingRefund ? (
          <div className="flex flex-col gap-2 rounded-lg border border-[#EAE3D7] bg-[#FBF8F2] p-3">
            <div className="flex flex-wrap gap-2">
              <label className="flex flex-col gap-1 font-body text-[11.5px] font-medium text-[#5E4A40]">
                Amount refunded (₹)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  disabled={isPending}
                  className="w-32 rounded-md border border-[#EAE3D7] bg-white px-2.5 py-2 font-body text-[13px] text-[#2A1F1A] outline-none focus:border-[#C9A24B]"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 font-body text-[11.5px] font-medium text-[#5E4A40]">
                UPI reference (UTR)
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. 415712345678"
                  className="min-w-40 rounded-md border border-[#EAE3D7] bg-white px-2.5 py-2 font-body text-[13px] text-[#2A1F1A] outline-none focus:border-[#C9A24B]"
                />
              </label>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => move("Refunded", { amount: Number(amountRupees), reference })}
                disabled={isPending || !reference.trim() || !(Number(amountRupees) > 0)}
                className={`${actionBase} border-[#BFE0C9] bg-[#E7F3EB] text-[#15692F]`}
              >
                {isPending ? "Recording…" : "Record refund"}
              </button>
              <button
                type="button"
                onClick={() => setIsRecordingRefund(false)}
                disabled={isPending}
                className={`${actionBase} border-[#E7E0D4] bg-white text-[#5E4A40]`}
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setIsRecordingRefund(true)}
              disabled={isPending}
              className={`${actionBase} flex-1 border-[#BFE0C9] bg-[#E7F3EB] text-[#15692F]`}
            >
              Record UPI refund…
            </button>
            <button
              type="button"
              onClick={() => move("Exchanged")}
              disabled={isPending}
              className={`${actionBase} flex-1 border-[#D9C49A] bg-[#FBF1DD] text-[#A87A1E]`}
            >
              Mark exchanged
            </button>
          </div>
        ))}
    </article>
  )
}

function NoteInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
  placeholder: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      maxLength={500}
      placeholder={placeholder}
      className="rounded-md border border-[#EAE3D7] bg-white px-3 py-2 font-body text-[12.5px] text-[#2A1F1A] outline-none placeholder:text-[#B8AC9F] focus:border-[#C9A24B]"
    />
  )
}

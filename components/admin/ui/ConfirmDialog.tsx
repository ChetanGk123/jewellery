"use client"

import { type ReactNode } from "react"
import { useDialog } from "@/hooks/useDialog"

type Props = {
  /** Accessible label for the dialog + heading text. */
  title: string
  /** Explanatory copy — plain text or rich nodes (e.g. a highlighted name). */
  body: ReactNode
  /** Label on the destructive confirm button (e.g. "Cancel order"). */
  confirmLabel: string
  /** Label shown on the confirm button while the action runs. */
  pendingLabel: string
  /** Label on the dismiss button. Defaults to "Keep it". */
  dismissLabel?: string
  isPending: boolean
  /** Disable the confirm button (e.g. an import preview with row errors). */
  confirmDisabled?: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

/**
 * Shared confirmation dialog for destructive admin actions (TASKS 5.4). An
 * overlay + card `alertdialog` that mirrors the Coupon/Category modal shell;
 * focuses the dismiss button on open and closes on Escape (both blocked while
 * the action is pending). The server RPC remains the real authority — this only
 * guards against a single-click misfire. Reused by Team revoke, order cancel,
 * and subscriber remove.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pendingLabel,
  dismissLabel = "Keep it",
  isPending,
  confirmDisabled = false,
  error,
  onConfirm,
  onClose,
}: Props) {
  const dialogRef = useDialog<HTMLDivElement>({
    isOpen: true,
    onDismiss: onClose,
    isPending,
  })

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(42,10,18,0.45)] p-6"
      onClick={() => {
        if (!isPending) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-[420px] max-w-full overflow-hidden rounded-[14px] bg-[#F8F5EF] shadow-[0_30px_70px_rgba(42,10,18,0.3)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2.5 px-[26px] py-6">
          <h2 className="font-heading text-[22px] leading-tight text-[#2A1F1A]">{title}</h2>
          <p className="font-body text-[13.5px] leading-relaxed text-[#5E4A40]">{body}</p>

          {error && (
            <p className="mt-1 rounded-lg border border-[#F0C8CE] bg-[#FBE9E7] px-3 py-2.5 font-body text-[12.5px] leading-snug text-[#C0392F]">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#E7E0D4] bg-white px-[26px] py-[18px]">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-[#DAD0C2] bg-white px-5 py-[11px] font-body text-[12px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
          >
            {dismissLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || confirmDisabled}
            className="rounded-lg bg-[#C0392F] px-6 py-[11px] font-body text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

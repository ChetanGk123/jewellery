"use client"

import { useState, useTransition } from "react"
import { sweepUnusedImages } from "@/app/(admin)/admin/(console)/settings/actions"
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog"
import { SectionCard } from "./SectionCard"

type SweepOutcome = { removed: number; scanned: number; freedBytes: number }

/**
 * Settings → Storage: the "Clean up unused images" maintenance action (the
 * ground-truth sweep behind the write-time GC — see sweepUnusedAdminImages).
 * Standalone from the page's dirty/save flow: it runs immediately behind a
 * confirm dialog and reports its outcome inline.
 */
export function StorageCard() {
  const [isConfirming, setIsConfirming] = useState(false)
  const [outcome, setOutcome] = useState<SweepOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const runSweep = () => {
    setError(null)
    startTransition(async () => {
      const res = await sweepUnusedImages()
      if (res.ok) {
        setOutcome({ removed: res.removed, scanned: res.scanned, freedBytes: res.freedBytes })
        setIsConfirming(false)
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <SectionCard
      id="storage"
      iconBg="#E7EEE7"
      icon={<SparkleIcon />}
      title="Storage"
      subtitle="Housekeeping for uploaded imagery"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-[30px] py-[26px] max-sm:px-5">
        <div className="min-w-0 max-w-[560px]">
          <div className="font-body text-[14px] font-semibold text-[#2B2420]">
            Clean up unused images
          </div>
          <p className="m-0 mt-1 font-body text-[12.5px] leading-relaxed text-[#8B8177]">
            Deletes uploaded files that no product or category uses any more — replaced photos,
            abandoned uploads, and leftovers from bulk imports. Anything uploaded in the last 24
            hours is left untouched.
          </p>
          {outcome && (
            <p
              role="status"
              className="m-0 mt-2 font-body text-[12.5px] font-medium text-[#3E8552]"
            >
              {outcome.removed === 0
                ? `Nothing to remove — all ${outcome.scanned} stored image${plural(outcome.scanned)} are in use.`
                : `Removed ${outcome.removed} unused image${plural(outcome.removed)} (${formatBytes(outcome.freedBytes)}) out of ${outcome.scanned} scanned.`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setError(null)
            setIsConfirming(true)
          }}
          disabled={isPending}
          className="shrink-0 rounded-lg border border-[#DAD0C2] bg-white px-5 py-[11px] font-body text-[13px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
        >
          {isPending ? "Cleaning up…" : "Clean up now"}
        </button>
      </div>

      {isConfirming && (
        <ConfirmDialog
          title="Clean up unused images?"
          body="This scans the image bucket and permanently deletes files that no product or category links to. Images uploaded in the last 24 hours are kept, just in case an edit is still in progress."
          confirmLabel="Clean up"
          pendingLabel="Cleaning up…"
          dismissLabel="Not now"
          isPending={isPending}
          error={error}
          onConfirm={runSweep}
          onClose={() => setIsConfirming(false)}
        />
      )}
    </SectionCard>
  )
}

function plural(count: number): string {
  return count === 1 ? "" : "s"
}

/** Human-readable size for the result line (storage sizes are small here). */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"
        stroke="#3E8552"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"
        stroke="#3E8552"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </svg>
  )
}

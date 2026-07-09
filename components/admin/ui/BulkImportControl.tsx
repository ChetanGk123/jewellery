"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog"
import type {
  ApplyResult,
  ImportPreview,
  ParseImportResult,
  RowError,
} from "@/lib/admin/bulk/types"

type Props = {
  /** Plural noun for copy, e.g. "products". */
  entityLabel: string
  /** GET endpoint that streams the .xlsx export. */
  exportHref: string
  parseAction: (formData: FormData) => Promise<ParseImportResult>
  applyAction: (formData: FormData) => Promise<ApplyResult>
}

/** How many row errors to list in the dialog before truncating. */
const MAX_VISIBLE_ERRORS = 8

/** Success toasts dismiss themselves; errors stay until closed. */
const SUCCESS_TOAST_MS = 6000

/**
 * "Export .xlsx" + "Import" pair for the admin toolbars (bulk edit flow).
 * Import is two-step: the file is dry-run through the entity's parse action
 * for a preview (creates / updates / unchanged / row errors) inside the shared
 * ConfirmDialog, then the SAME file is re-posted to the apply action, which
 * re-validates server-side and writes all-or-nothing via the 0037 bulk RPCs.
 */
export function BulkImportControl({ entityLabel, exportHref, parseAction, applyAction }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Success notices clear themselves so the toast never lingers into the
  // admin's next task; errors stay until dismissed.
  useEffect(() => {
    if (notice?.kind !== "success") return
    const timer = setTimeout(() => setNotice(null), SUCCESS_TOAST_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const closeDialog = () => {
    setPreview(null)
    setFile(null)
    setDialogError(null)
  }

  const onPick = (picked: File | null) => {
    if (!picked) return
    setNotice(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append("file", picked)
      const result = await parseAction(formData)
      if (!result.ok) {
        setNotice({ kind: "error", text: result.error })
        return
      }
      setFile(picked)
      setDialogError(null)
      setPreview(result.preview)
    })
  }

  const onConfirm = () => {
    if (!file || !preview || preview.errors.length > 0) return
    startTransition(async () => {
      const formData = new FormData()
      formData.append("file", file)
      const result = await applyAction(formData)
      if (!result.ok) {
        setDialogError(result.error ?? "Couldn't import the sheet.")
        if (result.rowErrors?.length) {
          setPreview((prev) => (prev ? { ...prev, errors: result.rowErrors ?? [] } : prev))
        }
        return
      }
      closeDialog()
      setNotice({
        kind: "success",
        text: `Imported ${result.created ?? 0} new and updated ${result.updated ?? 0} ${entityLabel}.`,
      })
      router.refresh()
    })
  }

  const changed = preview ? preview.creates + preview.updates : 0

  return (
    <>
      <a
        href={exportHref}
        download
        className="inline-flex items-center gap-2 rounded-lg border border-[#DAD0C2] bg-white px-[18px] py-[11px] font-body text-[12px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2]"
      >
        Export .xlsx
      </a>
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-lg border border-[#DAD0C2] bg-white px-[18px] py-[11px] font-body text-[12px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
      >
        {isPending && !preview ? "Checking…" : "Import"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        aria-label={`Import ${entityLabel} from .xlsx`}
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null)
          e.target.value = "" // allow re-picking the same file after fixes
        }}
      />

      {notice &&
        // Portal to <body> so the toast never disturbs the toolbar layout
        // (an inline block here forced the button row to wrap and stack).
        createPortal(
          <div
            role={notice.kind === "error" ? "alert" : "status"}
            className={`fixed right-6 top-20 z-[90] flex w-[360px] max-w-[calc(100vw-48px)] items-start gap-2.5 rounded-lg border px-4 py-3 font-body text-[12.5px] leading-snug shadow-[0_16px_40px_rgba(42,10,18,0.18)] ${
              notice.kind === "error"
                ? "border-[#F0C8CE] bg-[#FBE9E7] text-[#C0392F]"
                : "border-[#CFE3D4] bg-[#E7F3EB] text-[#1B7A3D]"
            }`}
          >
            <span className="flex-1">{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss"
              className="text-[15px] leading-none opacity-70 transition-opacity hover:opacity-100"
            >
              ×
            </button>
          </div>,
          document.body,
        )}

      {preview && (
        <ConfirmDialog
          title={`Import ${entityLabel}`}
          body={<PreviewBody preview={preview} entityLabel={entityLabel} />}
          confirmLabel={
            preview.errors.length > 0
              ? "Fix the sheet first"
              : `Import ${changed} change${changed === 1 ? "" : "s"}`
          }
          pendingLabel="Importing…"
          dismissLabel="Cancel"
          isPending={isPending}
          confirmDisabled={preview.errors.length > 0 || changed === 0}
          error={dialogError}
          onConfirm={onConfirm}
          onClose={() => {
            if (!isPending) closeDialog()
          }}
        />
      )}
    </>
  )
}

function PreviewBody({ preview, entityLabel }: { preview: ImportPreview; entityLabel: string }) {
  return (
    <span className="flex flex-col gap-2">
      <span>
        {preview.creates} new · {preview.updates} updated · {preview.unchanged} unchanged (of{" "}
        {preview.totalRows} rows). Nothing is saved until you confirm; the import is all-or-nothing.
      </span>
      {preview.errors.length > 0 && (
        <span className="flex max-h-[180px] flex-col gap-1 overflow-y-auto rounded-lg border border-[#F0C8CE] bg-[#FBE9E7] px-3 py-2 text-[12.5px] text-[#C0392F]">
          <span className="font-semibold">
            {preview.errors.length} row{preview.errors.length === 1 ? "" : "s"} need fixing — no{" "}
            {entityLabel} will be imported until the sheet is clean:
          </span>
          {preview.errors.slice(0, MAX_VISIBLE_ERRORS).map((err) => (
            <span key={`${err.rowNum}-${err.column}-${err.message}`}>{errorLine(err)}</span>
          ))}
          {preview.errors.length > MAX_VISIBLE_ERRORS && (
            <span>…and {preview.errors.length - MAX_VISIBLE_ERRORS} more.</span>
          )}
        </span>
      )}
    </span>
  )
}

function errorLine(err: RowError): string {
  return err.column
    ? `Row ${err.rowNum} — ${err.column}: ${err.message}`
    : `Row ${err.rowNum}: ${err.message}`
}

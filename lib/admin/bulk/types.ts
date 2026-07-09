/**
 * Shared types + cell-coercion helpers for the bulk Excel import/export
 * (products / categories / coupons). Client-safe and dependency-free so the
 * per-entity parse/serialize modules stay pure and Bun-testable; everything
 * xlsx-specific lives in the server-only `xlsx.ts`.
 */

/** Hard ceiling on data rows per import (also enforced by the bulk RPCs). */
export const MAX_IMPORT_ROWS = 2000

/** Reject uploads bigger than this before parsing (see next.config bodySizeLimit). */
export const MAX_IMPORT_FILE_BYTES = 4 * 1024 * 1024

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** One column of an entity's sheet. `header` doubles as the parse key. */
export type BulkColumn = {
  header: string
  /** Exported for reference but ignored on import (greyed in the sheet). */
  readOnly?: boolean
  /** Force Excel text format so values like "007" keep leading zeros. */
  text?: boolean
  /** Attach a dropdown fed by this named list (see xlsx.ts `dropdowns`). */
  dropdown?: string
  /** Column width hint in characters. */
  width?: number
}

/** A data row as read from the sheet: cells keyed by header + its sheet row. */
export type RawRow = {
  rowNum: number
  cells: Record<string, unknown>
}

export type RowError = {
  /** The 1-based sheet row the admin sees in Excel. */
  rowNum: number
  column: string
  message: string
}

/** What the preview dialog shows before anything is written. */
export type ImportPreview = {
  creates: number
  updates: number
  unchanged: number
  totalRows: number
  errors: RowError[]
}

/** One valid, changed row ready for the bulk RPC. */
export type PlannedRow = {
  rowNum: number
  /** null → create; uuid → update. */
  id: string | null
  payload: Record<string, unknown>
}

/**
 * The full result of planning an import: the RPC-ready rows plus the preview.
 * Both the preview action and the apply action derive from the same plan, so
 * what the admin confirmed is exactly what gets written.
 */
export type ImportPlan = {
  rows: PlannedRow[]
  preview: ImportPreview
}

/** What `parse*Import` returns to the client for the preview dialog. */
export type ParseImportResult = { ok: true; preview: ImportPreview } | { ok: false; error: string }

export type ApplyResult = {
  ok: boolean
  created?: number
  updated?: number
  error?: string
  /** Per-row failures surfaced by the RPC (all-or-nothing: nothing was written). */
  rowErrors?: RowError[]
}

/** Cell → trimmed string ("" for blank/null). Numbers/booleans stringify. */
export function cellText(value: unknown): string {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

/**
 * Cell → finite number, or null when blank. Accepts numeric cells and numeric
 * strings (commas stripped — Excel may render ₹1,299 in a text column).
 */
export function cellNumber(value: unknown): number | null {
  if (value == null || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const text = String(value).replace(/[,\s]/g, "")
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

/** Cell → boolean. Accepts real booleans, TRUE/FALSE, yes/no, 1/0; blank → false. */
export function cellBool(value: unknown): boolean | null {
  if (value == null || value === "") return false
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null
  const text = String(value).trim().toLowerCase()
  if (["true", "yes", "y", "1"].includes(text)) return true
  if (["false", "no", "n", "0"].includes(text)) return false
  return null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Cell → uuid string, null for blank, or undefined when malformed. */
export function cellId(value: unknown): string | null | undefined {
  const text = cellText(value)
  if (!text) return null
  return UUID_RE.test(text) ? text.toLowerCase() : undefined
}

/** Normalise DB null and sheet "" to the same value for unchanged-diffing. */
export function blankAsEmpty(value: string | null | undefined): string {
  return value ?? ""
}

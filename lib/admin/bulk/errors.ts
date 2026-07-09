/**
 * Decode the `BULK_ROW_ERRORS:<json>` exception the 0037 bulk RPCs raise when
 * any row fails (the whole batch rolled back). Pure string parsing so the
 * import actions share it and it stays unit-testable.
 */

import type { RowError } from "./types"

const MARKER = "BULK_ROW_ERRORS:"

type RawRpcRowError = { row_num?: number; code?: string; message?: string }

/**
 * Extract per-row diagnostics from an RPC error message, translating each
 * through the entity's `friendly(code, raw)` mapper. Returns null when the
 * message isn't a bulk-row failure (caller falls back to a generic message).
 */
export function parseBulkRowErrors(
  message: string,
  friendly: (code: string, raw: string) => string,
): RowError[] | null {
  const start = message.indexOf(MARKER)
  if (start === -1) return null
  try {
    const parsed = JSON.parse(message.slice(start + MARKER.length)) as RawRpcRowError[]
    if (!Array.isArray(parsed)) return null
    return parsed.map((e) => ({
      rowNum: e.row_num ?? 0,
      column: "",
      message: friendly(e.code ?? "", e.message ?? ""),
    }))
  } catch {
    return null
  }
}

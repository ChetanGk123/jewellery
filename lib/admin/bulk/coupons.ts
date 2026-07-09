/**
 * Coupons sheet: column spec, export serialization, and import planning.
 * Pure module — payloads carry exactly the keys `admin_upsert_coupon` expects
 * (the same shape `upsertCoupon` in coupons/actions.ts sends). `usage_count`
 * is export-only and structurally unwritable (never in the payload).
 */

import type { AdminCouponRow } from "@/lib/admin/coupon"
import type { CouponKind } from "@/lib/coupons"
import { paiseToRupees } from "@/lib/utils/money"
import {
  type BulkColumn,
  type ImportPlan,
  type PlannedRow,
  type RawRow,
  type RowError,
  cellBool,
  cellId,
  cellNumber,
  cellText,
} from "./types"

export const COUPONS_SHEET = "Coupons"

export const COUPON_KINDS = ["percent", "fixed", "free_shipping"] as const

export const COUPON_COLUMNS: BulkColumn[] = [
  { header: "ID", text: true, width: 38 },
  { header: "Code", text: true, width: 16 },
  { header: "Type", dropdown: "kinds", width: 14 },
  { header: "Value", width: 10 },
  { header: "Min order (₹)", width: 13 },
  { header: "Max discount (₹)", width: 16 },
  { header: "Usage limit", width: 11 },
  { header: "Expires", text: true, width: 12 },
  { header: "Active", dropdown: "bool", width: 9 },
  { header: "Used", readOnly: true, width: 8 },
]

/**
 * Stored expiry instant → the sheet's YYYY-MM-DD. Expiries are written as
 * end-of-day IST (18:29:59 UTC), so the UTC calendar date IS the date the
 * admin picked — this round-trips exactly with `parseExpiry`.
 */
function expiryDateOnly(expiresAt: string | null): string {
  if (!expiresAt) return ""
  const parsed = new Date(expiresAt)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toISOString().slice(0, 10)
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Sheet cell (Excel date or YYYY-MM-DD text) → stored instant, "" → null. */
function parseExpiry(value: unknown): { ok: boolean; expiresAt: string | null } {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { ok: false, expiresAt: null }
    return { ok: true, expiresAt: `${value.toISOString().slice(0, 10)}T18:29:59.000Z` }
  }
  const text = cellText(value)
  if (!text) return { ok: true, expiresAt: null }
  if (!DATE_ONLY_RE.test(text)) return { ok: false, expiresAt: null }
  return { ok: true, expiresAt: `${text}T18:29:59.000Z` }
}

/** One exported sheet row, aligned with COUPON_COLUMNS. */
export function serializeCouponRow(row: AdminCouponRow): Array<string | number | boolean> {
  return [
    row.id,
    row.code,
    row.kind,
    row.kind === "fixed" ? paiseToRupees(row.value) : row.value,
    row.minSubtotalPaise != null ? paiseToRupees(row.minSubtotalPaise) : "",
    row.maxDiscountPaise != null ? paiseToRupees(row.maxDiscountPaise) : "",
    row.usageLimit ?? "",
    expiryDateOnly(row.expiresAt),
    row.isActive,
    row.usageCount,
  ]
}

export type CouponsImportContext = {
  existing: AdminCouponRow[]
}

/** Validate and classify coupon rows; see planProductsImport for the model. */
export function planCouponsImport(rows: RawRow[], ctx: CouponsImportContext): ImportPlan {
  const errors: RowError[] = []
  const planned: PlannedRow[] = []
  let creates = 0
  let updates = 0
  let unchanged = 0

  const existingById = new Map(ctx.existing.map((c) => [c.id, c]))
  const couponIdByCode = new Map(ctx.existing.map((c) => [c.code.toUpperCase(), c.id]))
  const seenIds = new Set<string>()
  const seenCodes = new Set<string>()

  for (const row of rows) {
    const { rowNum, cells } = row
    const fail = (column: string, message: string) => errors.push({ rowNum, column, message })
    const before = errors.length

    const id = cellId(cells["ID"])
    if (id === undefined) fail("ID", "Not a valid coupon ID — leave blank to create.")
    if (id) {
      if (seenIds.has(id)) fail("ID", "This ID appears more than once in the sheet.")
      else if (!existingById.has(id)) {
        fail("ID", "No coupon has this ID — the sheet may be stale. Re-export and retry.")
      }
      seenIds.add(id)
    }
    const existing = id ? existingById.get(id) : undefined

    const code = cellText(cells["Code"]).toUpperCase()
    if (!code) fail("Code", "Coupon code is required.")
    else {
      const ownerId = couponIdByCode.get(code)
      if (seenCodes.has(code)) fail("Code", "This code appears more than once in the sheet.")
      else if (ownerId && ownerId !== (id ?? "")) {
        fail("Code", "Another coupon already uses this code — edit that row via its ID.")
      }
      seenCodes.add(code)
    }

    const kindRaw = cellText(cells["Type"]).toLowerCase()
    const kind = (COUPON_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as CouponKind)
      : null
    if (!kind) fail("Type", "Type must be percent, fixed, or free_shipping.")

    const valueNum = cellNumber(cells["Value"])
    let value = 0
    if (kind === "percent") {
      if (valueNum == null || valueNum < 0 || valueNum > 100) {
        fail("Value", "Percent coupons need a value between 0 and 100.")
      } else value = Math.round(valueNum)
    } else if (kind === "fixed") {
      if (valueNum == null || valueNum < 0) fail("Value", "Fixed coupons need a rupee amount.")
      else value = Math.round(valueNum * 100)
    } else if (kind === "free_shipping" && valueNum != null && valueNum !== 0) {
      fail("Value", "Free-shipping coupons take no value — leave it blank.")
    }

    const minRaw = cellText(cells["Min order (₹)"])
    const minNum = minRaw ? cellNumber(cells["Min order (₹)"]) : null
    if (minRaw && (minNum == null || minNum < 0)) {
      fail("Min order (₹)", "Enter a valid minimum order in rupees.")
    }

    const maxRaw = cellText(cells["Max discount (₹)"])
    const maxNum = maxRaw ? cellNumber(cells["Max discount (₹)"]) : null
    if (maxRaw && kind !== "percent") {
      fail("Max discount (₹)", "Max discount only applies to percent coupons.")
    } else if (maxRaw && (maxNum == null || maxNum < 0)) {
      fail("Max discount (₹)", "Enter a valid cap in rupees.")
    }

    const limitRaw = cellText(cells["Usage limit"])
    const limitNum = limitRaw ? cellNumber(cells["Usage limit"]) : null
    if (limitRaw && (limitNum == null || !Number.isInteger(limitNum) || limitNum < 0)) {
      fail("Usage limit", "Usage limit must be a whole number of 0 or more.")
    }

    const expiry = parseExpiry(cells["Expires"])
    if (!expiry.ok) fail("Expires", "Use a date cell or YYYY-MM-DD, or leave blank.")

    const isActive = cellBool(cells["Active"])
    if (isActive == null) fail("Active", "Use TRUE or FALSE.")

    if (errors.length > before) continue

    const payload = {
      code,
      kind,
      value,
      min_subtotal_paise: minNum != null ? Math.round(minNum * 100) : null,
      max_discount_paise: kind === "percent" && maxNum != null ? Math.round(maxNum * 100) : null,
      usage_limit: limitNum,
      expires_at: expiry.expiresAt,
      is_active: isActive,
    }

    if (existing) {
      if (
        payload.code === existing.code &&
        payload.kind === existing.kind &&
        payload.value === existing.value &&
        payload.min_subtotal_paise === existing.minSubtotalPaise &&
        payload.max_discount_paise === existing.maxDiscountPaise &&
        payload.usage_limit === existing.usageLimit &&
        payload.expires_at === existing.expiresAt &&
        payload.is_active === existing.isActive
      ) {
        unchanged += 1
        continue
      }
      updates += 1
    } else {
      creates += 1
    }

    planned.push({ rowNum, id: id ?? null, payload })
  }

  return {
    rows: planned,
    preview: { creates, updates, unchanged, totalRows: rows.length, errors },
  }
}

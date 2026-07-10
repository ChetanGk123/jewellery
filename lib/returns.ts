/**
 * Returns & COD reconciliation — pure, client-safe logic (TASKS 8.7b).
 *
 * The return flow lives in a sibling `return_request` table (0043), one per
 * order, so the fulfilment status machine (`lib/admin/order-status.ts`) stays
 * untouched: Requested → Approved → Received → Refunded | Exchanged, with
 * Rejected reachable only from Requested. The RPCs (`customer_request_return`,
 * `admin_set_return_status`) enforce the same rules server-side.
 *
 * Policy (operator decisions, 2026-07-10): window + shipping payer are
 * settings-driven (`setting.returns`, resolved here); settlement is a manual
 * UPI refund or an exchange; 1–3 photos are required with every request.
 */

import { z } from "zod"
import type { StatusChip } from "@/lib/admin/order-status"

export type ReturnStatus =
  | "Requested"
  | "Approved"
  | "Received"
  | "Refunded"
  | "Exchanged"
  | "Rejected"

export type ReturnResolution = "refund" | "exchange"

/** Legal admin moves per state — kept in lockstep with `admin_set_return_status`. */
export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  Requested: ["Approved", "Rejected"],
  Approved: ["Received"],
  Received: ["Refunded", "Exchanged"],
  Refunded: [],
  Exchanged: [],
  Rejected: [],
}

export const RETURN_STATUSES = Object.keys(RETURN_TRANSITIONS) as ReturnStatus[]

export function canTransitionReturn(from: string, to: string): boolean {
  const moves = RETURN_TRANSITIONS[from as ReturnStatus]
  return moves !== undefined && moves.includes(to as ReturnStatus)
}

/** Same chip shape as the fulfilment statuses so both render identically. */
const CHIPS: Record<ReturnStatus, StatusChip> = {
  Requested: { label: "Requested", color: "#B7791F", bg: "#FBF1DD" },
  Approved: { label: "Approved", color: "#1B6FA8", bg: "#E4F0F8" },
  Received: { label: "Received", color: "#7A5CB5", bg: "#EFEAF9" },
  Refunded: { label: "Refunded", color: "#1B7A3D", bg: "#E7F3EB" },
  Exchanged: { label: "Exchanged", color: "#1B7A3D", bg: "#E7F3EB" },
  Rejected: { label: "Rejected", color: "#C0392F", bg: "#FBE9E7" },
}

const FALLBACK_CHIP: StatusChip = { label: "—", color: "#8A7E74", bg: "#F1ECE3" }

export function returnStatusChip(status: string): StatusChip {
  return CHIPS[status as ReturnStatus] ?? { ...FALLBACK_CHIP, label: status }
}

// ── Admin queue filters (client-safe; the server read lives in lib/db) ───────

/** Queue tabs: live work / settled history / everything. */
export type ReturnFilter = "Open" | "Closed" | "All"
export const RETURN_FILTERS: ReturnFilter[] = ["Open", "Closed", "All"]

export function toReturnFilter(raw: string | undefined): ReturnFilter {
  return raw === "Closed" || raw === "All" ? raw : "Open"
}

// ── Eligibility window ────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

/** Last eligible instant (epoch ms), or null when there's no usable anchor. */
export function returnDeadline(deliveredAt: string | null, windowDays: number): number | null {
  if (!deliveredAt || windowDays <= 0) return null
  const delivered = Date.parse(deliveredAt)
  if (Number.isNaN(delivered)) return null
  return delivered + windowDays * DAY_MS
}

/**
 * Whether the customer's self-serve "Request return" is still open — mirrors
 * the `customer_request_return` window check. Gates only the request UI; the
 * operator can always settle things out-of-band.
 */
export function isReturnEligible(
  deliveredAt: string | null,
  windowDays: number,
  now: number,
): boolean {
  const deadline = returnDeadline(deliveredAt, windowDays)
  return deadline !== null && now <= deadline
}

// ── Settings (`setting.returns` blob) ─────────────────────────────────────────

export type ShippingPayer = "customer" | "store" | "store_for_defects"

export type ReturnSettings = {
  /** Days after delivery the self-serve request stays open; 0 disables returns. */
  windowDays: number
  shippingPayer: ShippingPayer
}

export const DEFAULT_RETURN_SETTINGS: ReturnSettings = {
  windowDays: 7,
  shippingPayer: "customer",
}

const MAX_WINDOW_DAYS = 365

const SHIPPING_PAYERS: ShippingPayer[] = ["customer", "store", "store_for_defects"]

/** Settings-form select labels. */
export const SHIPPING_PAYER_LABELS: Record<ShippingPayer, string> = {
  customer: "Customer pays return shipping",
  store: "Store pays return shipping",
  store_for_defects: "Store pays only for defective / wrong items",
}

/** Customer-facing note for the request form and the approval email. */
export const SHIPPING_PAYER_CUSTOMER_COPY: Record<ShippingPayer, string> = {
  customer: "Return shipping is arranged and paid by you — courier the item to our store address.",
  store: "We bear the return shipping — courier the item to our store address and we'll reimburse the charge.",
  store_for_defects:
    "If the item is defective or not what you ordered, we bear the return shipping; otherwise the courier charge is yours.",
}

/**
 * Resolve the raw `setting.returns` jsonb over the defaults — tolerant of any
 * shape (the 0042/email_copy lesson: a settings read must never take the
 * storefront down). Blob keys are snake_case, mirroring what the
 * `customer_request_return` RPC reads.
 */
export function resolveReturnSettings(raw: unknown): ReturnSettings {
  const record =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  const rawDays =
    typeof record.window_days === "number"
      ? record.window_days
      : typeof record.window_days === "string"
        ? Number(record.window_days)
        : Number.NaN
  const windowDays = Number.isFinite(rawDays)
    ? Math.min(MAX_WINDOW_DAYS, Math.max(0, Math.floor(rawDays)))
    : DEFAULT_RETURN_SETTINGS.windowDays

  const shippingPayer = SHIPPING_PAYERS.includes(record.shipping_payer as ShippingPayer)
    ? (record.shipping_payer as ShippingPayer)
    : DEFAULT_RETURN_SETTINGS.shippingPayer

  return { windowDays, shippingPayer }
}

/** Build the `setting.returns` blob for the `admin_update_settings` payload. */
export function returnSettingsToBlob(settings: ReturnSettings): {
  window_days: number
  shipping_payer: ShippingPayer
} {
  return { window_days: settings.windowDays, shipping_payer: settings.shippingPayer }
}

// ── Request form validation ───────────────────────────────────────────────────

/** Standard UPI VPA shape — mirrors the `customer_request_return` check. */
export const UPI_RE = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z]{2,64}$/

export const MIN_RETURN_PHOTOS = 1
export const MAX_RETURN_PHOTOS = 3
export const RETURN_PHOTO_MAX_BYTES = 5 * 1024 * 1024

/**
 * The request form's field validation (photos are `File`s validated in the
 * server action, so they're not part of this schema). A refund ask must carry
 * a valid UPI VPA; an exchange ask ignores/drops whatever was typed so a
 * half-filled field never leaks into the request.
 */
export const returnRequestSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "Tell us what went wrong.")
      .max(1000, "Please keep the reason under 1000 characters."),
    resolution: z.enum(["refund", "exchange"]),
    upiId: z.string().trim().toLowerCase().max(320),
  })
  .superRefine((value, ctx) => {
    if (value.resolution === "refund" && !UPI_RE.test(value.upiId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["upiId"],
        message: "Enter a valid UPI ID (like name@bank) for the refund.",
      })
    }
  })
  .transform((value) => (value.resolution === "exchange" ? { ...value, upiId: "" } : value))

export type ReturnRequestInput = z.infer<typeof returnRequestSchema>

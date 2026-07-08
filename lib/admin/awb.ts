/**
 * Courier AWB (air waybill) validation (6.4). Shiprocket integration stays
 * deferred — couriers are booked outside the app, so the operator records the
 * tracking number by hand. Kept in lockstep with the `admin_set_order_awb`
 * RPC (0031), which enforces the same rules server-side.
 */

export const AWB_MAX_LEN = 40

/** Alphanumeric with common courier separators; must start alphanumeric. */
const AWB_RE = /^[A-Za-z0-9][A-Za-z0-9 /_-]*$/

/** Trimmed AWB when valid, else null. */
export function normalizeAwb(raw: string): string | null {
  const awb = raw.trim()
  if (!awb || awb.length > AWB_MAX_LEN || !AWB_RE.test(awb)) return null
  return awb
}

/**
 * Whether the drawer shows the AWB card. Irrelevant before the parcel stage
 * (Pending/Confirmed — nothing to book yet), so it hides until Packed; a
 * recorded AWB always shows, so data is never invisible (incl. terminal
 * orders, where the card renders read-only).
 */
export function showAwbCard(status: string, awb: string | null): boolean {
  if (awb) return true
  return status === "Packed" || status === "Shipped"
}

export const TRACKING_URL_MAX_LEN = 300

/**
 * Trimmed courier tracking URL when valid, else null. http(s) only — the
 * storefront renders this as a customer-clickable link, so `javascript:` and
 * friends must never pass. Blank input is a valid "no link" and also returns
 * null; callers treat null from non-blank input as a validation error.
 */
export function normalizeTrackingUrl(raw: string): string | null {
  const url = raw.trim()
  if (!url || url.length > TRACKING_URL_MAX_LEN) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : null
  } catch {
    return null
  }
}

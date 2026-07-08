/**
 * Internal order notes (TASKS 5.16). Notes are free-text operator context
 * ("deliver after 6pm") stored as `order.note` rows in the 5.8 audit log —
 * client-safe validation lives here so the drawer form and the server action
 * enforce the same rule.
 */

/** Hard cap, mirrored by the `admin_add_order_note` RPC (0028). */
export const NOTE_MAX_LEN = 500

/**
 * Trim an operator-typed note; null when nothing usable remains (empty,
 * whitespace-only, or over the cap). Interior newlines are kept.
 */
export function normalizeOrderNote(raw: string): string | null {
  const note = raw.trim()
  if (!note || note.length > NOTE_MAX_LEN) return null
  return note
}

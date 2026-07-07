/**
 * Pending-order ageing (TASKS 5.18). A COD order sitting unconfirmed goes
 * stale fast — these thresholds surface the ones the operator should chase.
 * Client-safe pure logic.
 */

const HOUR_MS = 3_600_000;
const STALE_MS = 12 * HOUR_MS;
const CRITICAL_MS = 24 * HOUR_MS;

export type PendingAge = { label: "12h+" | "24h+"; tone: "amber" | "red" };

/**
 * How overdue a still-Pending order is: null under 12h (fine), amber "12h+",
 * red "24h+". Unparseable dates return null (no chip beats a wrong chip).
 */
export function pendingAge(
  createdAtIso: string,
  nowMs: number,
): PendingAge | null {
  const age = nowMs - Date.parse(createdAtIso);
  if (Number.isNaN(age) || age < STALE_MS) return null;
  if (age >= CRITICAL_MS) return { label: "24h+", tone: "red" };
  return { label: "12h+", tone: "amber" };
}

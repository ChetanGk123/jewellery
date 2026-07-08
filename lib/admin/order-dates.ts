/**
 * Order-queue date window (6.7). The queue defaults to a short recent window
 * (today and the two days before, IST) so the operator lands on what needs
 * action now; `?from=all` opts out, and explicit `?from`/`?to` set a custom
 * range. Pure calendar-date math — timezone handling (IST day bounds) lives
 * with the query in lib/db/admin-orders.ts.
 */

/** Strict `YYYY-MM-DD`, as emitted by `<input type="date">`. */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Default window: today plus this many days before it. */
export const DEFAULT_ORDER_WINDOW_DAYS = 2

export type OrderDateRange = {
  /** Inclusive calendar start (`YYYY-MM-DD`), or null when unbounded. */
  from: string | null
  /** Inclusive calendar end (`YYYY-MM-DD`), or null when unbounded. */
  to: string | null
  /** True when the operator chose "All dates" (`?from=all`). */
  isAll: boolean
  /** True when no valid params were given and the default window applies. */
  isDefault: boolean
}

/**
 * A calendar date's midnight in IST, as an ISO instant for timestamptz
 * comparison — e.g. "2026-07-06" → "2026-07-05T18:30:00.000Z".
 */
export function istDayStartIso(date: string): string {
  return new Date(`${date}T00:00:00+05:30`).toISOString()
}

/** Shift a `YYYY-MM-DD` date by whole days (UTC math — no DST surprises). */
export function shiftDate(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Resolve untrusted `?from`/`?to` params into a usable range. `from` anchors
 * the range: without a valid `from` there is no custom range (a lone `to`
 * falls back to the default window). An invalid or inverted `to` is repaired
 * to `max(from, today)` rather than erroring.
 */
export function toOrderDateRange(
  from: string | undefined,
  to: string | undefined,
  today: string,
): OrderDateRange {
  if (from === "all") return { from: null, to: null, isAll: true, isDefault: false }

  const validFrom = from && DATE_RE.test(from) ? from : null
  const validTo = to && DATE_RE.test(to) ? to : null

  if (validFrom) {
    const repairedTo = validFrom > today ? validFrom : today
    const end = validTo && validTo >= validFrom ? validTo : repairedTo
    return { from: validFrom, to: end, isAll: false, isDefault: false }
  }

  return {
    from: shiftDate(today, -DEFAULT_ORDER_WINDOW_DAYS),
    to: today,
    isAll: false,
    isDefault: true,
  }
}

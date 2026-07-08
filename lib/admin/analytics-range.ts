import { DATE_RE } from "./order-dates"

/**
 * Analytics date window (6.10). The analytics view defaults to the last 6
 * calendar months (the original fixed window); `?from/?to` narrow or move it.
 * Client-safe pure calendar math — IST day bounds live with the query in
 * lib/db/admin-analytics.ts. Repair semantics mirror lib/admin/order-dates.ts:
 * `from` anchors a custom range, a bad or inverted `to` becomes
 * `max(from, today)`, anything else falls back to the default.
 */

/** Default window: this month plus the 5 before it. */
export const DEFAULT_ANALYTICS_MONTHS = 6

/** Longest selectable window — keeps the monthly chart readable. */
export const MAX_ANALYTICS_MONTHS = 12

export type AnalyticsRange = {
  /** Inclusive calendar start, `YYYY-MM-DD`. */
  from: string
  /** Inclusive calendar end, `YYYY-MM-DD`. */
  to: string
  /** True when no valid params were given and the 6-month default applies. */
  isDefault: boolean
}

/** One month column in the sales history. */
export type MonthBucket = {
  /** `YYYY-MM`, matching the IST month key of an order's `created_at`. */
  key: string
  /** "Jul", or "Jul 26" when the range crosses a year boundary. */
  label: string
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** First day of the month `back` months before the date's month. */
function monthStart(dateIso: string, back: number): string {
  const [year, month] = dateIso.split("-").map(Number)
  const zero = month - 1 - back
  const y = year + Math.floor(zero / 12)
  const m = ((zero % 12) + 12) % 12
  return `${y}-${String(m + 1).padStart(2, "0")}-01`
}

/** Resolve untrusted `?from`/`?to` params into a bounded analytics window. */
export function toAnalyticsRange(
  from: string | undefined,
  to: string | undefined,
  today: string,
): AnalyticsRange {
  const validFrom = from && DATE_RE.test(from) ? from : null
  const validTo = to && DATE_RE.test(to) ? to : null

  if (validFrom) {
    const repairedTo = validFrom > today ? validFrom : today
    const end = validTo && validTo >= validFrom ? validTo : repairedTo
    const earliest = monthStart(end, MAX_ANALYTICS_MONTHS - 1)
    return { from: validFrom < earliest ? earliest : validFrom, to: end, isDefault: false }
  }

  return { from: monthStart(today, DEFAULT_ANALYTICS_MONTHS - 1), to: today, isDefault: true }
}

/**
 * One bucket per calendar month the range touches, oldest first. Labels carry
 * a two-digit year when the range spans more than one calendar year.
 */
export function monthBuckets(from: string, to: string): MonthBucket[] {
  const [fromYear, fromMonth] = from.split("-").map(Number)
  const [toYear, toMonth] = to.split("-").map(Number)
  const withYear = fromYear !== toYear
  const out: MonthBucket[] = []
  for (let y = fromYear, m = fromMonth; y < toYear || (y === toYear && m <= toMonth);) {
    const label = withYear ? `${MONTH_LABELS[m - 1]} ${String(y).slice(2)}` : MONTH_LABELS[m - 1]
    out.push({ key: `${y}-${String(m).padStart(2, "0")}`, label })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/** "01 Feb 2026" from "2026-02-01" (UTC — plain calendar dates, no TZ shift). */
function formatDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/** Human caption for the active window, e.g. "10 Apr 2026 – 20 Jun 2026". */
export function rangeLabel(range: AnalyticsRange): string {
  if (range.isDefault) return `Last ${DEFAULT_ANALYTICS_MONTHS} months`
  return `${formatDate(range.from)} – ${formatDate(range.to)}`
}

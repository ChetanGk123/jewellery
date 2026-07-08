import { describe, expect, test } from "bun:test"
import {
  DEFAULT_ANALYTICS_MONTHS,
  MAX_ANALYTICS_MONTHS,
  monthBuckets,
  rangeLabel,
  toAnalyticsRange,
} from "./analytics-range"

describe("toAnalyticsRange", () => {
  const today = "2026-07-08"

  test("defaults to the last 6 calendar months ending today", () => {
    expect(toAnalyticsRange(undefined, undefined, today)).toEqual({
      from: "2026-02-01",
      to: today,
      isDefault: true,
    })
    expect(DEFAULT_ANALYTICS_MONTHS).toBe(6)
  })

  test("default window crosses a year boundary", () => {
    expect(toAnalyticsRange(undefined, undefined, "2026-03-15")).toEqual({
      from: "2025-10-01",
      to: "2026-03-15",
      isDefault: true,
    })
  })

  test("keeps a valid custom from/to pair", () => {
    expect(toAnalyticsRange("2026-04-10", "2026-06-20", today)).toEqual({
      from: "2026-04-10",
      to: "2026-06-20",
      isDefault: false,
    })
  })

  test("from without to runs up to today", () => {
    expect(toAnalyticsRange("2026-05-01", undefined, today)).toEqual({
      from: "2026-05-01",
      to: today,
      isDefault: false,
    })
  })

  test("inverted from/to repairs to from..today", () => {
    expect(toAnalyticsRange("2026-06-01", "2026-01-01", today)).toEqual({
      from: "2026-06-01",
      to: today,
      isDefault: false,
    })
  })

  test("ranges longer than the cap clamp from to the last 12 months", () => {
    const range = toAnalyticsRange("2024-01-15", "2026-07-08", today)
    expect(range.from).toBe("2025-08-01")
    expect(range.to).toBe("2026-07-08")
    expect(MAX_ANALYTICS_MONTHS).toBe(12)
  })

  test("garbage inputs fall back to the default window", () => {
    expect(toAnalyticsRange("last week", "junk", today).isDefault).toBe(true)
  })
})

describe("monthBuckets", () => {
  test("one bucket per covered month, oldest first", () => {
    expect(monthBuckets("2026-02-01", "2026-07-08")).toEqual([
      { key: "2026-02", label: "Feb" },
      { key: "2026-03", label: "Mar" },
      { key: "2026-04", label: "Apr" },
      { key: "2026-05", label: "May" },
      { key: "2026-06", label: "Jun" },
      { key: "2026-07", label: "Jul" },
    ])
  })

  test("a range inside one month yields a single bucket", () => {
    expect(monthBuckets("2026-07-02", "2026-07-08")).toEqual([{ key: "2026-07", label: "Jul" }])
  })

  test("year-crossing ranges carry the year in labels", () => {
    expect(monthBuckets("2025-11-10", "2026-01-05")).toEqual([
      { key: "2025-11", label: "Nov 25" },
      { key: "2025-12", label: "Dec 25" },
      { key: "2026-01", label: "Jan 26" },
    ])
  })
})

describe("rangeLabel", () => {
  test("default window reads as the last 6 months", () => {
    expect(rangeLabel({ from: "2026-02-01", to: "2026-07-08", isDefault: true })).toBe(
      "Last 6 months",
    )
  })

  test("custom windows show the explicit dates", () => {
    expect(rangeLabel({ from: "2026-04-10", to: "2026-06-20", isDefault: false })).toBe(
      "10 Apr 2026 – 20 Jun 2026",
    )
  })
})

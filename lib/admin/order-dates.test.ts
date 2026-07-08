import { describe, expect, test } from "bun:test"
import { DEFAULT_ORDER_WINDOW_DAYS, shiftDate, toOrderDateRange } from "./order-dates"

describe("shiftDate", () => {
  test("moves back within a month", () => {
    expect(shiftDate("2026-07-08", -2)).toBe("2026-07-06")
  })

  test("crosses a year boundary backwards", () => {
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31")
  })

  test("handles leap-day arithmetic", () => {
    expect(shiftDate("2024-02-28", 1)).toBe("2024-02-29")
  })

  test("crosses a month boundary forwards", () => {
    expect(shiftDate("2026-07-31", 1)).toBe("2026-08-01")
  })
})

describe("toOrderDateRange", () => {
  const today = "2026-07-08"

  test("defaults to the last N days ending today", () => {
    expect(toOrderDateRange(undefined, undefined, today)).toEqual({
      from: shiftDate(today, -DEFAULT_ORDER_WINDOW_DAYS),
      to: today,
      isAll: false,
      isDefault: true,
    })
  })

  test("'all' opts out of date filtering entirely", () => {
    expect(toOrderDateRange("all", "2026-06-01", today)).toEqual({
      from: null,
      to: null,
      isAll: true,
      isDefault: false,
    })
  })

  test("keeps a valid custom from/to pair", () => {
    expect(toOrderDateRange("2026-06-01", "2026-06-30", today)).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
      isAll: false,
      isDefault: false,
    })
  })

  test("from without to runs up to today", () => {
    expect(toOrderDateRange("2026-06-01", undefined, today)).toEqual({
      from: "2026-06-01",
      to: today,
      isAll: false,
      isDefault: false,
    })
  })

  test("a future from keeps to >= from", () => {
    expect(toOrderDateRange("2026-08-01", undefined, today)).toEqual({
      from: "2026-08-01",
      to: "2026-08-01",
      isAll: false,
      isDefault: false,
    })
  })

  test("inverted from/to falls back to from..today", () => {
    expect(toOrderDateRange("2026-07-01", "2026-06-01", today)).toEqual({
      from: "2026-07-01",
      to: today,
      isAll: false,
      isDefault: false,
    })
  })

  test("garbage inputs fall back to the default window", () => {
    expect(toOrderDateRange("07/06/2026", "junk", today).isDefault).toBe(true)
  })

  test("to without from falls back to the default window", () => {
    expect(toOrderDateRange(undefined, "2026-06-30", today).isDefault).toBe(true)
  })
})

import { describe, expect, test } from "bun:test"
import {
  canTransitionReturn,
  isReturnEligible,
  resolveReturnSettings,
  returnDeadline,
  returnRequestSchema,
  returnStatusChip,
  RETURN_TRANSITIONS,
} from "./returns"

const NOW = Date.parse("2026-07-10T12:00:00Z")
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()

describe("RETURN_TRANSITIONS / canTransitionReturn", () => {
  test("Requested forks to Approved or Rejected", () => {
    expect(RETURN_TRANSITIONS.Requested).toEqual(["Approved", "Rejected"])
    expect(canTransitionReturn("Requested", "Approved")).toBe(true)
    expect(canTransitionReturn("Requested", "Rejected")).toBe(true)
    expect(canTransitionReturn("Requested", "Received")).toBe(false)
  })

  test("Approved only advances to Received", () => {
    expect(canTransitionReturn("Approved", "Received")).toBe(true)
    expect(canTransitionReturn("Approved", "Refunded")).toBe(false)
    expect(canTransitionReturn("Approved", "Rejected")).toBe(false)
  })

  test("Received settles as Refunded or Exchanged", () => {
    expect(canTransitionReturn("Received", "Refunded")).toBe(true)
    expect(canTransitionReturn("Received", "Exchanged")).toBe(true)
    expect(canTransitionReturn("Received", "Rejected")).toBe(false)
  })

  test("terminal states allow nothing", () => {
    for (const terminal of ["Refunded", "Exchanged", "Rejected"] as const) {
      expect(RETURN_TRANSITIONS[terminal]).toEqual([])
      expect(canTransitionReturn(terminal, "Requested")).toBe(false)
    }
  })

  test("unknown statuses never transition", () => {
    expect(canTransitionReturn("Bogus", "Approved")).toBe(false)
    expect(canTransitionReturn("Requested", "Bogus")).toBe(false)
  })
})

describe("returnDeadline / isReturnEligible", () => {
  test("deadline is delivered_at + window days", () => {
    expect(returnDeadline(daysAgo(2), 7)).toBe(NOW + 5 * 86_400_000)
  })

  test("null / unparseable delivered_at yields no deadline and no eligibility", () => {
    expect(returnDeadline(null, 7)).toBeNull()
    expect(returnDeadline("not-a-date", 7)).toBeNull()
    expect(isReturnEligible(null, 7, NOW)).toBe(false)
    expect(isReturnEligible("not-a-date", 7, NOW)).toBe(false)
  })

  test("window 0 disables returns entirely", () => {
    expect(isReturnEligible(daysAgo(0), 0, NOW)).toBe(false)
  })

  test("inside the window is eligible, past it is not", () => {
    expect(isReturnEligible(daysAgo(6.9), 7, NOW)).toBe(true)
    expect(isReturnEligible(daysAgo(7.1), 7, NOW)).toBe(false)
  })

  test("the deadline instant itself is still eligible", () => {
    expect(isReturnEligible(daysAgo(7), 7, NOW)).toBe(true)
  })
})

describe("resolveReturnSettings", () => {
  test("empty / junk blobs fall back to the defaults", () => {
    expect(resolveReturnSettings({})).toEqual({ windowDays: 7, shippingPayer: "customer" })
    expect(resolveReturnSettings(null)).toEqual({ windowDays: 7, shippingPayer: "customer" })
    expect(resolveReturnSettings("junk")).toEqual({ windowDays: 7, shippingPayer: "customer" })
    expect(resolveReturnSettings([1, 2])).toEqual({ windowDays: 7, shippingPayer: "customer" })
  })

  test("reads the snake_case blob keys", () => {
    expect(resolveReturnSettings({ window_days: 15, shipping_payer: "store" })).toEqual({
      windowDays: 15,
      shippingPayer: "store",
    })
  })

  test("accepts numeric strings and floors fractions", () => {
    expect(resolveReturnSettings({ window_days: "10" }).windowDays).toBe(10)
    expect(resolveReturnSettings({ window_days: 7.9 }).windowDays).toBe(7)
  })

  test("0 disables (kept), negatives and huge values clamp", () => {
    expect(resolveReturnSettings({ window_days: 0 }).windowDays).toBe(0)
    expect(resolveReturnSettings({ window_days: -3 }).windowDays).toBe(0)
    expect(resolveReturnSettings({ window_days: 9999 }).windowDays).toBe(365)
  })

  test("unknown shipping payer falls back to customer", () => {
    expect(resolveReturnSettings({ shipping_payer: "courier-fairy" }).shippingPayer).toBe(
      "customer",
    )
  })
})

describe("returnRequestSchema", () => {
  const base = {
    reason: "The clasp arrived broken.",
    resolution: "exchange" as const,
    upiId: "",
  }

  test("accepts a plain exchange request", () => {
    const parsed = returnRequestSchema.safeParse(base)
    expect(parsed.success).toBe(true)
  })

  test("refund requires a valid UPI VPA", () => {
    expect(returnRequestSchema.safeParse({ ...base, resolution: "refund" }).success).toBe(false)
    expect(
      returnRequestSchema.safeParse({ ...base, resolution: "refund", upiId: "asha@okhdfc" })
        .success,
    ).toBe(true)
  })

  test("rejects malformed UPI VPAs", () => {
    for (const bad of ["@okhdfc", "asha@", "asha okhdfc", "a@b1"]) {
      expect(
        returnRequestSchema.safeParse({ ...base, resolution: "refund", upiId: bad }).success,
      ).toBe(false)
    }
  })

  test("UPI is normalised to trimmed lowercase", () => {
    const parsed = returnRequestSchema.parse({
      ...base,
      resolution: "refund",
      upiId: "  Asha@OkHDFC ",
    })
    expect(parsed.upiId).toBe("asha@okhdfc")
  })

  test("exchange requests drop any typed UPI", () => {
    const parsed = returnRequestSchema.parse({ ...base, upiId: "asha@okhdfc" })
    expect(parsed.upiId).toBe("")
  })

  test("reason is required and capped at 1000 chars", () => {
    expect(returnRequestSchema.safeParse({ ...base, reason: "   " }).success).toBe(false)
    expect(returnRequestSchema.safeParse({ ...base, reason: "x".repeat(1001) }).success).toBe(
      false,
    )
  })
})

describe("returnStatusChip", () => {
  test("known statuses get their own chip", () => {
    expect(returnStatusChip("Requested").label).toBe("Requested")
    expect(returnStatusChip("Refunded").label).toBe("Refunded")
  })

  test("unknown statuses fall back but keep the label", () => {
    const chip = returnStatusChip("Weird")
    expect(chip.label).toBe("Weird")
  })
})

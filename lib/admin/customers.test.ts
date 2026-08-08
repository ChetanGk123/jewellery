import { describe, expect, test } from "bun:test"
import {
  averageOrderPaise,
  cancellationRate,
  customerChip,
  tallyHistory,
  toCustomerSort,
} from "./customers"

describe("toCustomerSort", () => {
  test("accepts the known sorts", () => {
    expect(toCustomerSort("spend")).toBe("spend")
    expect(toCustomerSort("name")).toBe("name")
  })

  test("falls back to recent for missing or hostile input", () => {
    expect(toCustomerSort(undefined)).toBe("recent")
    expect(toCustomerSort("")).toBe("recent")
    expect(toCustomerSort("lifetime_paise desc; drop table review")).toBe("recent")
  })
})

describe("customerChip", () => {
  test("flags any cancellation ahead of loyalty", () => {
    // A repeat buyer who has also cancelled must still show the risk chip —
    // on COD the delivery signal matters more than the spend signal.
    expect(customerChip(5, 1)?.label).toBe("Has cancelled")
  })

  test("marks a repeat customer from the third order", () => {
    expect(customerChip(2, 0)).toBeNull()
    expect(customerChip(3, 0)?.label).toBe("Repeat")
  })

  test("leaves a clean first-time buyer unchipped", () => {
    expect(customerChip(1, 0)).toBeNull()
  })
})

describe("cancellationRate", () => {
  test("is a rounded percentage of all orders", () => {
    expect(cancellationRate(4, 1)).toBe(25)
    expect(cancellationRate(3, 1)).toBe(33)
    expect(cancellationRate(5, 0)).toBe(0)
  })

  test("returns 0 rather than NaN with no orders", () => {
    expect(cancellationRate(0, 0)).toBe(0)
  })
})

describe("averageOrderPaise", () => {
  test("divides lifetime spend by the orders that actually counted", () => {
    // lifetimePaise excludes cancelled orders, so the divisor must too:
    // 300000 over 3 paid orders is 100000, not 300000/4.
    expect(averageOrderPaise(300000, 4, 1)).toBe(100000)
  })

  test("returns 0 when every order was cancelled", () => {
    expect(averageOrderPaise(0, 2, 2)).toBe(0)
  })

  test("returns 0 for a customer with no orders", () => {
    expect(averageOrderPaise(0, 0, 0)).toBe(0)
  })
})

describe("tallyHistory", () => {
  test("groups by user, not by phone", () => {
    // The bug this replaced: two accounts share one phone number in this
    // store's data, so a phone tally reported 4 orders for buyers with 3 and 1.
    const rows = [
      { user_id: "u1", status: "Delivered" },
      { user_id: "u1", status: "Pending" },
      { user_id: "u1", status: "Pending" },
      { user_id: "u2", status: "Pending" },
    ]

    const out = tallyHistory(rows)

    expect(out.get("u1")?.orders).toBe(3)
    expect(out.get("u2")?.orders).toBe(1)
  })

  test("counts cancellations alongside the order total", () => {
    const out = tallyHistory([
      { user_id: "u1", status: "Cancelled" },
      { user_id: "u1", status: "Delivered" },
    ])

    expect(out.get("u1")).toEqual({ orders: 2, cancelled: 1 })
  })

  test("skips rows with no user_id rather than grouping them together", () => {
    // Legacy seed orders have no identity — lumping them under one key would
    // invent a customer who placed all of them.
    const out = tallyHistory([
      { user_id: null, status: "Pending" },
      { user_id: null, status: "Pending" },
    ])

    expect(out.size).toBe(0)
  })
})

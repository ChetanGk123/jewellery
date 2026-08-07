import { describe, expect, test } from "bun:test"
import { nextStatus, prevStatus, showPrintActions } from "./order-status"

describe("showPrintActions", () => {
  test("hides printing until the order is confirmed", () => {
    expect(showPrintActions("Pending")).toBe(false)
  })

  test("shows printing from Confirmed onward", () => {
    for (const status of ["Confirmed", "Packed", "Shipped", "Delivered"]) {
      expect(showPrintActions(status)).toBe(true)
    }
  })

  test("stays hidden for cancelled and unknown statuses", () => {
    expect(showPrintActions("Cancelled")).toBe(false)
    expect(showPrintActions("Bogus")).toBe(false)
  })
})

describe("prevStatus", () => {
  test("steps one back along the flow", () => {
    expect(prevStatus("Confirmed")).toBe("Pending")
    expect(prevStatus("Packed")).toBe("Confirmed")
    expect(prevStatus("Shipped")).toBe("Packed")
  })

  test("has nowhere to go from the start of the flow", () => {
    expect(prevStatus("Pending")).toBeNull()
  })

  test("terminal and off-flow statuses can't move back", () => {
    expect(prevStatus("Delivered")).toBeNull()
    expect(prevStatus("Cancelled")).toBeNull()
    expect(prevStatus("Bogus")).toBeNull()
  })

  test("mirrors nextStatus so back-then-forward round-trips", () => {
    expect(nextStatus(prevStatus("Packed") ?? "")).toBe("Packed")
  })
})

import { describe, expect, test } from "bun:test"
import {
  AWB_MAX_LEN,
  TRACKING_URL_MAX_LEN,
  normalizeAwb,
  normalizeTrackingUrl,
  showAwbCard,
} from "./awb"

describe("normalizeAwb", () => {
  test("accepts a typical courier AWB and trims whitespace", () => {
    expect(normalizeAwb("  SR123456789  ")).toBe("SR123456789")
  })

  test("accepts the allowed separators", () => {
    expect(normalizeAwb("BD 1234/AX_9-7")).toBe("BD 1234/AX_9-7")
  })

  test("rejects empty and whitespace-only input", () => {
    expect(normalizeAwb("")).toBeNull()
    expect(normalizeAwb("   ")).toBeNull()
  })

  test("rejects input over the cap", () => {
    expect(normalizeAwb("A".repeat(AWB_MAX_LEN))).toBe("A".repeat(AWB_MAX_LEN))
    expect(normalizeAwb("A".repeat(AWB_MAX_LEN + 1))).toBeNull()
  })

  test("rejects disallowed characters", () => {
    expect(normalizeAwb("AWB#123")).toBeNull()
    expect(normalizeAwb("AWB<script>")).toBeNull()
  })

  test("rejects a leading separator", () => {
    expect(normalizeAwb("-SR123")).toBeNull()
    expect(normalizeAwb("/SR123")).toBeNull()
  })
})

describe("normalizeTrackingUrl", () => {
  test("accepts http(s) URLs and trims whitespace", () => {
    expect(normalizeTrackingUrl(" https://shiprocket.co/tracking/SR123 ")).toBe(
      "https://shiprocket.co/tracking/SR123",
    )
    expect(normalizeTrackingUrl("http://track.example/x?awb=1")).toBe(
      "http://track.example/x?awb=1",
    )
  })

  test("empty means 'no link' — returns null without complaint", () => {
    expect(normalizeTrackingUrl("")).toBeNull()
    expect(normalizeTrackingUrl("   ")).toBeNull()
  })

  test("rejects non-http schemes (javascript:, data:, mailto:)", () => {
    expect(normalizeTrackingUrl("javascript:alert(1)")).toBeNull()
    expect(normalizeTrackingUrl("data:text/html,x")).toBeNull()
    expect(normalizeTrackingUrl("mailto:a@b.c")).toBeNull()
  })

  test("rejects unparseable input and over-cap length", () => {
    expect(normalizeTrackingUrl("not a url")).toBeNull()
    expect(normalizeTrackingUrl(`https://t.example/${"a".repeat(TRACKING_URL_MAX_LEN)}`)).toBeNull()
  })
})

describe("showAwbCard", () => {
  test("hidden before the parcel stage when nothing is recorded", () => {
    expect(showAwbCard("Pending", null)).toBe(false)
    expect(showAwbCard("Confirmed", null)).toBe(false)
  })

  test("shown from Packed onward", () => {
    expect(showAwbCard("Packed", null)).toBe(true)
    expect(showAwbCard("Shipped", null)).toBe(true)
  })

  test("a recorded AWB is always visible, whatever the status", () => {
    expect(showAwbCard("Pending", "SR123")).toBe(true)
    expect(showAwbCard("Delivered", "SR123")).toBe(true)
    expect(showAwbCard("Cancelled", "SR123")).toBe(true)
  })

  test("terminal orders with no AWB have nothing to show", () => {
    expect(showAwbCard("Delivered", null)).toBe(false)
    expect(showAwbCard("Cancelled", null)).toBe(false)
  })
})

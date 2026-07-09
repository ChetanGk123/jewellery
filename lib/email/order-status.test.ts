import { expect, test } from "bun:test"
import { buildOrderStatusEmail, type OrderStatusEmailKind } from "./order-status"
import { resolveStoreInfo } from "@/lib/store-info"

const base = {
  orderNo: "JR-260706-1001-AB12",
  customerName: "Aarav",
  totalPaise: 329900,
  orderUrl: "https://shop.example/order/JR-260706-1001-AB12",
}

const KINDS: OrderStatusEmailKind[] = ["Shipped", "Delivered", "Cancelled"]

test.each(KINDS)("%s email carries order no, total and link in both bodies", (kind) => {
  const msg = buildOrderStatusEmail({ ...base, kind })

  expect(msg.subject).toContain(base.orderNo)
  expect(msg.subject).toContain(kind.toLowerCase())
  for (const body of [msg.html, msg.text]) {
    expect(body).toContain(base.orderNo)
    expect(body).toContain("₹3,299")
    expect(body).toContain(base.orderUrl)
  }
})

test("Shipped keeps the COD 'keep amount ready' cue; Cancelled says not charged", () => {
  expect(buildOrderStatusEmail({ ...base, kind: "Shipped" }).text).toContain(
    "keep the amount ready",
  )
  expect(buildOrderStatusEmail({ ...base, kind: "Cancelled" }).text).toContain(
    "haven't been charged",
  )
})

test("HTML-escapes the customer name (no injection)", () => {
  const msg = buildOrderStatusEmail({
    ...base,
    kind: "Shipped",
    customerName: '<script>alert("x")</script>',
  })
  expect(msg.html).not.toContain("<script>")
  expect(msg.html).toContain("&lt;script&gt;")
})

test("falls back to 'there' when the name is blank", () => {
  const msg = buildOrderStatusEmail({ ...base, kind: "Delivered", customerName: "  " })
  expect(msg.text).toContain("Namaste there,")
})

test("Shipped carries the AWB tracking row in both bodies when present", () => {
  const msg = buildOrderStatusEmail({ ...base, kind: "Shipped", awb: "SR123456789" })
  expect(msg.text).toContain("SR123456789")
  expect(msg.html).toContain("SR123456789")
})

test("Shipped links the AWB to the tracking page when a link is on file", () => {
  const msg = buildOrderStatusEmail({
    ...base,
    kind: "Shipped",
    awb: "SR123456789",
    trackingUrl: "https://track.example/SR123456789",
  })
  expect(msg.html).toContain('href="https://track.example/SR123456789"')
  expect(msg.text).toContain("https://track.example/SR123456789")
})

test("no tracking row without an AWB, and none on non-Shipped emails", () => {
  expect(buildOrderStatusEmail({ ...base, kind: "Shipped" }).text).not.toContain("Tracking")
  expect(
    buildOrderStatusEmail({ ...base, kind: "Delivered", awb: "SR123456789" }).text,
  ).not.toContain("SR123456789")
})

test("a resolved store info overrides the brand in subject and footer (6.15)", () => {
  const info = resolveStoreInfo({ storeName: "Meera Jewels", phone: "+91 88888 22222" })
  const msg = buildOrderStatusEmail({ ...base, kind: "Shipped" }, info)

  expect(msg.subject).toContain("Meera Jewels")
  expect(msg.html).toContain("MEERA JEWELS")
  for (const body of [msg.html, msg.text]) {
    expect(body).toContain("+91 88888 22222")
  }
})

test("Delivered email lists a review link per item (6.18)", () => {
  const msg = buildOrderStatusEmail({
    ...base,
    kind: "Delivered",
    items: [
      {
        name: "Polki Choker <Set>",
        reviewUrl: "https://shop.example/product/polki#reviews-heading",
      },
      { name: "Kundan Jhumkas", reviewUrl: null },
    ],
  })

  expect(msg.text).toContain(
    "Write a review: Polki Choker <Set> — https://shop.example/product/polki#reviews-heading",
  )
  expect(msg.html).toContain("https://shop.example/product/polki#reviews-heading")
  expect(msg.html).toContain("Polki Choker &lt;Set&gt;")
  expect(msg.html).not.toContain("Polki Choker <Set>")
  // Item without a live product page still shows, just unlinked in the text list.
  expect(msg.text).toContain("Kundan Jhumkas")
})

test("review links render only on Delivered, and never without items", () => {
  const items = [{ name: "Polki Choker", reviewUrl: "https://shop.example/p" }]
  expect(buildOrderStatusEmail({ ...base, kind: "Shipped", items }).text).not.toContain(
    "Write a review",
  )
  expect(buildOrderStatusEmail({ ...base, kind: "Cancelled", items }).text).not.toContain(
    "Write a review",
  )
  expect(buildOrderStatusEmail({ ...base, kind: "Delivered" }).text).not.toContain("Write a review")
})

import { expect, test } from "bun:test"
import { buildOrderStatusEmail, type OrderStatusEmailKind } from "./order-status"

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

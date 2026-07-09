import { expect, test } from "bun:test"
import { resolveEmailCopy } from "./copy"
import { buildDailyDigestEmail } from "./daily-digest"
import { resolveStoreInfo } from "@/lib/store-info"

const base = {
  dateIso: "2026-07-06",
  orders: 4,
  cancelled: 1,
  revenuePaise: 5120000,
  pendingOrders: 3,
  lowStockCount: 2,
  lowStock: [
    { name: "Polki Choker Necklace Set", sku: "JR-NK-014", stock: 1 },
    { name: "Kundan Jhumkas", sku: "JR-ER-002", stock: 3 },
  ],
  adminUrl: "https://shop.example/admin",
}

test("subject carries the date, order count and revenue", () => {
  const msg = buildDailyDigestEmail(base)
  expect(msg.subject).toContain("06 Jul")
  expect(msg.subject).toContain("4 orders")
  expect(msg.subject).toContain("₹51,200")
})

test("bodies carry the KPIs, low-stock lines and the console link", () => {
  const msg = buildDailyDigestEmail(base)
  for (const body of [msg.html, msg.text]) {
    expect(body).toContain("₹51,200")
    expect(body).toContain("3") // pending orders
    expect(body).toContain("1 cancelled")
    expect(body).toContain("JR-NK-014")
    expect(body).toContain("Kundan Jhumkas")
    expect(body).toContain(base.adminUrl)
  }
})

test("omits the cancelled note when nothing was cancelled", () => {
  const msg = buildDailyDigestEmail({ ...base, cancelled: 0 })
  expect(msg.text).not.toContain("cancelled")
  expect(msg.html).not.toContain("cancelled")
})

test("says all stocked when no products are low", () => {
  const msg = buildDailyDigestEmail({
    ...base,
    lowStockCount: 0,
    lowStock: [],
  })
  expect(msg.text).toContain("No low-stock products")
})

test("pluralises the order count", () => {
  expect(buildDailyDigestEmail({ ...base, orders: 1 }).subject).toContain("1 order,")
})

test("escapes product names in the HTML body", () => {
  const msg = buildDailyDigestEmail({
    ...base,
    lowStock: [{ name: "<script>x</script>", sku: "JR-X", stock: 1 }],
  })
  expect(msg.html).not.toContain("<script>x</script>")
  expect(msg.html).toContain("&lt;script&gt;")
})

test("a resolved store info overrides the brand name and wordmark (6.15)", () => {
  const info = resolveStoreInfo({ storeName: "Meera Jewels" })
  const msg = buildDailyDigestEmail(base, info)
  expect(msg.text).toContain("Meera Jewels — daily digest")
  expect(msg.html).toContain("MEERA JEWELS · Admin")
})

test("custom copy overrides subject, heading and button (7.2)", () => {
  const copy = resolveEmailCopy({
    dailyDigest: {
      subject: "Close of {day}: {orders} for {revenue}",
      heading: "Numbers for {day}",
      button: "Review day",
    },
  }).dailyDigest

  const msg = buildDailyDigestEmail(base, undefined, copy)

  expect(msg.subject).toBe("Close of 06 Jul 2026: 4 orders for ₹51,200")
  expect(msg.html).toContain("Numbers for 06 Jul 2026")
  expect(msg.html).toContain("Review day")
})

test("hostile saved copy renders escaped (7.2)", () => {
  const copy = resolveEmailCopy({ dailyDigest: { heading: "<script>x</script> {day}" } }).dailyDigest
  const msg = buildDailyDigestEmail(base, undefined, copy)
  expect(msg.html).not.toContain("<script>")
  expect(msg.html).toContain("&lt;script&gt;")
})

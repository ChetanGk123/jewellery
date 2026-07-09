import { expect, test } from "bun:test"
import { resolveEmailCopy } from "./copy"
import { buildNewOrderAdminEmail } from "./admin-alert"
import { resolveStoreInfo } from "@/lib/store-info"

const base = {
  orderNo: "JR-260706-1001-AB12",
  customerName: "Aarav",
  city: "Jaipur",
  state: "Rajasthan",
  itemCount: 2,
  totalPaise: 329900,
  adminUrl: "https://shop.example/admin/orders",
}

test("subject and bodies carry order no, total and the console link", () => {
  const msg = buildNewOrderAdminEmail(base)

  expect(msg.subject).toContain(base.orderNo)
  expect(msg.subject).toContain("₹3,299")
  for (const body of [msg.html, msg.text]) {
    expect(body).toContain(base.orderNo)
    expect(body).toContain("Jaipur, Rajasthan")
    expect(body).toContain("₹3,299")
    expect(body).toContain(base.adminUrl)
  }
})

test("pluralises the item count", () => {
  expect(buildNewOrderAdminEmail({ ...base, itemCount: 1 }).text).toContain("1 item")
  expect(buildNewOrderAdminEmail({ ...base, itemCount: 3 }).text).toContain("3 items")
})

test("HTML-escapes the customer name", () => {
  const msg = buildNewOrderAdminEmail({ ...base, customerName: "<b>x</b>" })
  expect(msg.html).not.toContain("<b>x</b>")
  expect(msg.html).toContain("&lt;b&gt;x&lt;/b&gt;")
})

test("a resolved store info overrides the wordmark (6.15)", () => {
  const info = resolveStoreInfo({ storeName: "Meera Jewels" })
  const msg = buildNewOrderAdminEmail(base, info)
  expect(msg.html).toContain("MEERA JEWELS · Admin")
})

test("custom copy overrides subject, heading and button (7.2)", () => {
  const copy = resolveEmailCopy({
    adminAlert: {
      subject: "Kaching! {orderNo} worth {total}",
      heading: "Fresh order in",
      button: "Open console",
    },
  }).adminAlert

  const msg = buildNewOrderAdminEmail(base, undefined, copy)

  expect(msg.subject).toBe("Kaching! JR-260706-1001-AB12 worth ₹3,299")
  expect(msg.html).toContain("Fresh order in")
  expect(msg.html).toContain("Open console")
  expect(msg.text).toContain("Fresh order in: JR-260706-1001-AB12")
})

test("hostile saved copy renders escaped (7.2)", () => {
  const copy = resolveEmailCopy({ adminAlert: { heading: "<script>x</script>" } }).adminAlert
  const msg = buildNewOrderAdminEmail(base, undefined, copy)
  expect(msg.html).not.toContain("<script>")
  expect(msg.html).toContain("&lt;script&gt;")
})

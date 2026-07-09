import { expect, test } from "bun:test"
import {
  buildOrderConfirmationEmail,
  escapeHtml,
  type OrderConfirmationEmailInput,
} from "./order-confirmation"
import { resolveStoreInfo } from "@/lib/store-info"

const baseInput: OrderConfirmationEmailInput = {
  orderNo: "JR-260706-1010-AB12",
  customerName: "Asha Rao",
  addressLine: "12 MG Road, Shivaji Nagar",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
  totalPaise: 249900,
  orderUrl: "https://example.com/order/JR-260706-1010-AB12",
}

test("subject carries the order number", () => {
  // Arrange + Act
  const message = buildOrderConfirmationEmail(baseInput)

  // Assert
  expect(message.subject).toContain("JR-260706-1010-AB12")
})

test("html and text both carry the order number, INR total, address and link", () => {
  const message = buildOrderConfirmationEmail(baseInput)

  for (const body of [message.html, message.text]) {
    expect(body).toContain("JR-260706-1010-AB12")
    expect(body).toContain("₹2,499")
    expect(body).toContain("12 MG Road, Shivaji Nagar")
    expect(body).toContain("Bengaluru, Karnataka 560001")
    expect(body).toContain("https://example.com/order/JR-260706-1010-AB12")
  }
})

test("escapes customer-entered HTML in the html body", () => {
  const message = buildOrderConfirmationEmail({
    ...baseInput,
    customerName: '<img src=x onerror="alert(1)">',
    addressLine: "12 <b>MG</b> Road & Co",
  })

  expect(message.html).not.toContain("<img src=x")
  expect(message.html).toContain("&lt;img src=x")
  expect(message.html).toContain("12 &lt;b&gt;MG&lt;/b&gt; Road &amp; Co")
})

test("falls back to a generic greeting when the name is blank", () => {
  const message = buildOrderConfirmationEmail({
    ...baseInput,
    customerName: "   ",
  })

  expect(message.text).toContain("Namaste there")
})

test("a resolved store info overrides name, wordmark, phone and address (6.15)", () => {
  const info = resolveStoreInfo({
    storeName: "Meera Jewels",
    phone: "+91 88888 22222",
    storeInfo: { descriptor: "Handmade Silver", address: { line: "Meera Jewels, Pune" } },
  })

  const message = buildOrderConfirmationEmail(baseInput, info)

  expect(message.subject).toContain("Meera Jewels")
  expect(message.html).toContain("MEERA JEWELS")
  expect(message.html).toContain("Handmade Silver")
  expect(message.html).toContain("Meera Jewels, Pune")
  for (const body of [message.html, message.text]) {
    expect(body).toContain("+91 88888 22222")
  }
})

test("escapeHtml covers the five significant characters", () => {
  expect(escapeHtml(`<a href="x" & 'y'>`)).toBe("&lt;a href=&quot;x&quot; &amp; &#39;y&#39;&gt;")
})

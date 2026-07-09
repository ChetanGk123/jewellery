import { expect, test } from "bun:test"
import { resolveEmailCopy } from "./copy"
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

const itemisedInput: OrderConfirmationEmailInput = {
  ...baseInput,
  items: [
    { name: "Kundan Choker", tone: "Rose Gold", qty: 1, lineTotalPaise: 199900 },
    { name: "Jhumka Earrings", tone: null, qty: 2, lineTotalPaise: 50000 },
  ],
  subtotalPaise: 249900,
  discountPaise: 25000,
  shippingPaise: 0,
  totalPaise: 224900,
}

test("itemised order renders each line with tone, qty and line total in html and text", () => {
  const message = buildOrderConfirmationEmail(itemisedInput)

  for (const body of [message.html, message.text]) {
    expect(body).toContain("Kundan Choker")
    expect(body).toContain("Rose Gold")
    expect(body).toContain("₹1,999")
    expect(body).toContain("Jhumka Earrings")
    expect(body).toContain("×2")
    expect(body).toContain("₹500")
  }
})

test("price breakdown shows subtotal, discount as a saving, and free shipping", () => {
  const message = buildOrderConfirmationEmail(itemisedInput)

  for (const body of [message.html, message.text]) {
    expect(body).toContain("₹2,499") // subtotal
    expect(body).toContain("−₹250") // discount
    expect(body).toContain("Free") // shipping
    expect(body).toContain("₹2,249") // total
  }
})

test("discount row is omitted when nothing was discounted", () => {
  const message = buildOrderConfirmationEmail({
    ...itemisedInput,
    discountPaise: 0,
    shippingPaise: 9900,
    totalPaise: 259800,
  })

  expect(message.html).not.toContain("Discount")
  expect(message.text).not.toContain("Discount")
  expect(message.html).toContain("₹99") // flat-rate shipping shown as an amount
})

test("item names and tones are escaped in the html body", () => {
  const message = buildOrderConfirmationEmail({
    ...itemisedInput,
    items: [{ name: '<script>alert(1)</script>', tone: "<b>Gold</b>", qty: 1, lineTotalPaise: 100 }],
  })

  expect(message.html).not.toContain("<script>")
  expect(message.html).toContain("&lt;script&gt;")
  expect(message.html).toContain("&lt;b&gt;Gold&lt;/b&gt;")
})

test("renders without an order summary when items are absent (pre-6.x callers)", () => {
  const message = buildOrderConfirmationEmail(baseInput)

  expect(message.html).not.toContain("Order summary")
  expect(message.html).toContain("₹2,499")
})

test("custom copy overrides subject, heading, intro, notice and button (7.2)", () => {
  const copy = resolveEmailCopy({
    orderConfirmation: {
      subject: "Order {orderNo} confirmed by {storeName}",
      heading: "Dhanyavaad!",
      intro: "Hi {name} — {orderNo} is booked and on its way soon.",
      codNotice: "Keep {total} handy for our courier.",
      button: "Track it",
    },
  }).orderConfirmation

  const message = buildOrderConfirmationEmail(baseInput, undefined, copy)

  expect(message.subject).toBe("Order JR-260706-1010-AB12 confirmed by RJ Jewellers")
  expect(message.html).toContain("Dhanyavaad!")
  expect(message.html).toContain("Hi Asha Rao")
  expect(message.html).toContain("Track it")
  for (const body of [message.html, message.text]) {
    expect(body).toContain("Keep ₹2,499 handy for our courier.")
  }
})

test("hostile saved copy renders escaped, never as markup (7.2)", () => {
  const copy = resolveEmailCopy({
    orderConfirmation: { heading: '<script>alert(1)</script>', intro: "<b>{name}</b> ordered" },
  }).orderConfirmation

  const message = buildOrderConfirmationEmail(baseInput, undefined, copy)

  expect(message.html).not.toContain("<script>")
  expect(message.html).toContain("&lt;script&gt;")
  expect(message.html).toContain("&lt;b&gt;Asha Rao&lt;/b&gt; ordered")
})

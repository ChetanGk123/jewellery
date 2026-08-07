import { expect, test } from "bun:test"
import { DEFAULT_EMAIL_COPY, type EmailTemplateId, resolveEmailCopy } from "./copy"
import { buildSampleEmail } from "./samples"
import { DEFAULT_STORE_INFO } from "@/lib/store-info"

const ctx = {
  info: DEFAULT_STORE_INFO,
  copy: DEFAULT_EMAIL_COPY,
  baseUrl: "https://shop.example",
}

const ALL_IDS: EmailTemplateId[] = [
  "orderConfirmation",
  "orderConfirmed",
  "orderShipped",
  "orderDelivered",
  "orderCancelled",
  "adminAlert",
  "abandonedCart",
  "subscriberWelcome",
  "dailyDigest",
]

test.each(ALL_IDS)("%s sample builds a complete message with site links", (id) => {
  const msg = buildSampleEmail(id, ctx)

  expect(msg.subject.length).toBeGreaterThan(0)
  expect(msg.html).toContain("https://shop.example")
  expect(msg.text).toContain("https://shop.example")
})

test("saved copy overrides flow into the sample render", () => {
  const copy = resolveEmailCopy({ orderConfirmation: { heading: "Shukriya!" } })
  const msg = buildSampleEmail("orderConfirmation", { ...ctx, copy })

  expect(msg.html).toContain("Shukriya!")
})

test("status samples exercise their kind-specific extras", () => {
  // Shipped shows tracking; Delivered invites reviews.
  expect(buildSampleEmail("orderShipped", ctx).html).toContain("Tracking (AWB)")
  expect(buildSampleEmail("orderDelivered", ctx).html).toContain("Write a review")
})

test("samples render realistic INR amounts from integer paise", () => {
  const msg = buildSampleEmail("orderConfirmation", ctx)
  expect(msg.html).toMatch(/₹[\d,]+/)
})

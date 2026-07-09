import { expect, test } from "bun:test"
import {
  DEFAULT_EMAIL_COPY,
  EMAIL_COPY_DEFAULTS,
  escapeHtml,
  renderCopy,
  renderCopyHtml,
  resolveEmailCopy,
} from "./copy"

// ---------------------------------------------------------------- resolve

test("resolveEmailCopy of nothing returns the defaults", () => {
  expect(resolveEmailCopy({})).toEqual(EMAIL_COPY_DEFAULTS)
  expect(resolveEmailCopy(null)).toEqual(EMAIL_COPY_DEFAULTS)
  expect(resolveEmailCopy(undefined)).toEqual(EMAIL_COPY_DEFAULTS)
  expect(resolveEmailCopy("junk")).toEqual(EMAIL_COPY_DEFAULTS)
  expect(DEFAULT_EMAIL_COPY).toEqual(EMAIL_COPY_DEFAULTS)
})

test("a saved override wins over the default, others in the group survive", () => {
  const copy = resolveEmailCopy({
    orderConfirmation: { heading: "Shukriya for your order!" },
  })

  expect(copy.orderConfirmation.heading).toBe("Shukriya for your order!")
  // Untouched fields in the same group keep their defaults.
  expect(copy.orderConfirmation.subject).toBe(EMAIL_COPY_DEFAULTS.orderConfirmation.subject)
  // Untouched groups are the full defaults.
  expect(copy.abandonedCart).toEqual(EMAIL_COPY_DEFAULTS.abandonedCart)
})

test("blank, whitespace-only and non-string overrides keep the default", () => {
  const copy = resolveEmailCopy({
    orderConfirmation: { heading: "", intro: "   ", codNotice: 42, button: null },
    dailyDigest: "not-an-object",
  })

  expect(copy.orderConfirmation).toEqual(EMAIL_COPY_DEFAULTS.orderConfirmation)
  expect(copy.dailyDigest).toEqual(EMAIL_COPY_DEFAULTS.dailyDigest)
})

test("override values are trimmed and unknown keys are dropped", () => {
  const copy = resolveEmailCopy({
    subscriberWelcome: { heading: "  Welcome, bride-to-be  ", bogusField: "x" },
  })

  expect(copy.subscriberWelcome.heading).toBe("Welcome, bride-to-be")
  expect("bogusField" in copy.subscriberWelcome).toBe(false)
})

test("resolveEmailCopy never mutates the defaults", () => {
  const before = structuredClone(EMAIL_COPY_DEFAULTS)
  const copy = resolveEmailCopy({ adminAlert: { heading: "Changed" } })
  copy.orderShipped.heading = "mutated locally"

  expect(EMAIL_COPY_DEFAULTS).toEqual(before)
})

// ------------------------------------------------------------ token render

test("renderCopy substitutes known tokens, repeats included", () => {
  expect(renderCopy("Order {orderNo} — yes, {orderNo}", { orderNo: "JR-1" })).toBe(
    "Order JR-1 — yes, JR-1",
  )
})

test("renderCopy leaves unknown tokens literal", () => {
  expect(renderCopy("Hello {name}, code {mystery}", { name: "Asha" })).toBe(
    "Hello Asha, code {mystery}",
  )
})

test("renderCopyHtml escapes both the template text and substituted values", () => {
  const out = renderCopyHtml("Tom & Jerry <3 {name}", { name: '<img src=x onerror="a">' })

  expect(out).toBe("Tom &amp; Jerry &lt;3 &lt;img src=x onerror=&quot;a&quot;&gt;")
})

test("renderCopyHtml lets pre-rendered html vars through verbatim", () => {
  const out = renderCopyHtml(
    "your order {orderNo} is confirmed",
    {},
    { orderNo: '<strong style="color:#71182B;">JR-1</strong>' },
  )

  expect(out).toBe('your order <strong style="color:#71182B;">JR-1</strong> is confirmed')
})

test("a hostile copy template cannot inject markup", () => {
  const out = renderCopyHtml("<script>alert(1)</script> {total}", { total: "₹100" })

  expect(out).not.toContain("<script>")
  expect(out).toContain("&lt;script&gt;")
  expect(out).toContain("₹100")
})

// ---------------------------------------------------------------- defaults

test("defaults carry the exact live wording (spot checks per template)", () => {
  expect(EMAIL_COPY_DEFAULTS.orderConfirmation.subject).toBe(
    "Order confirmed — {orderNo} · {storeName}",
  )
  expect(EMAIL_COPY_DEFAULTS.orderConfirmation.intro).toBe(
    "Namaste {name}, your order {orderNo} is confirmed and will be delivered in 4–7 days.",
  )
  expect(EMAIL_COPY_DEFAULTS.orderShipped.intro).toBe(
    "Good news — order {orderNo} has been shipped and is on its way.",
  )
  expect(EMAIL_COPY_DEFAULTS.orderDelivered.heading).toBe("Delivered — thank you!")
  expect(EMAIL_COPY_DEFAULTS.orderCancelled.note).toBe(
    "Changed your mind? Your favourites are waiting — browse the collection anytime.",
  )
  expect(EMAIL_COPY_DEFAULTS.adminAlert.subject).toBe("New COD order {orderNo} — {total}")
  expect(EMAIL_COPY_DEFAULTS.abandonedCart.heading).toBe("Still thinking it over?")
  expect(EMAIL_COPY_DEFAULTS.subscriberWelcome.subject).toBe("Welcome to {storeName}")
  expect(EMAIL_COPY_DEFAULTS.dailyDigest.subject).toBe(
    "Daily digest — {day}: {orders}, {revenue}",
  )
})

test("escapeHtml covers the five significant characters (moved home)", () => {
  expect(escapeHtml(`<a href="x" & 'y'>`)).toBe("&lt;a href=&quot;x&quot; &amp; &#39;y&#39;&gt;")
})

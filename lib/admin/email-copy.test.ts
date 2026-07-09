import { expect, test } from "bun:test"
import { emailCopyFormSchema, emailCopyToFormValues, formValuesToEmailCopyPayload } from "./email-copy"
import { resolveEmailCopy } from "@/lib/email/copy"

test("an all-empty form (nothing overridden) validates", () => {
  const values = emailCopyToFormValues({})
  expect(emailCopyFormSchema.safeParse(values).success).toBe(true)
})

test("form values seed from SAVED overrides only — unset fields stay empty", () => {
  const values = emailCopyToFormValues({
    orderConfirmation: { heading: "Shukriya!", bogus: "dropped" },
    dailyDigest: "junk-shape",
  })

  expect(values.orderConfirmation.heading).toBe("Shukriya!")
  expect(values.orderConfirmation.subject).toBe("")
  expect(values.dailyDigest.heading).toBe("")
  expect("bogus" in values.orderConfirmation).toBe(false)
})

test("oversized fields are rejected", () => {
  const values = emailCopyToFormValues({})
  const parsed = emailCopyFormSchema.safeParse({
    ...values,
    orderConfirmation: { ...values.orderConfirmation, subject: "x".repeat(400) },
  })
  expect(parsed.success).toBe(false)
})

test("payload sends complete per-template objects so cleared fields reset to default", () => {
  const values = emailCopyToFormValues({ abandonedCart: { heading: "Old saved heading" } })
  const cleared = { ...values, abandonedCart: { ...values.abandonedCart, heading: "" } }
  const payload = formValuesToEmailCopyPayload(emailCopyFormSchema.parse(cleared))

  // The template object is sent whole, empty string included — the top-level
  // shallow merge replaces it, and resolve treats "" as "use the default".
  const cart = (payload as Record<string, Record<string, string>>).abandonedCart
  expect(cart.heading).toBe("")
  expect(resolveEmailCopy(payload).abandonedCart.heading).toBe("Still thinking it over?")
})

test("round trip: form → payload → resolve applies the operator's wording", () => {
  const values = emailCopyToFormValues({})
  const edited = {
    ...values,
    subscriberWelcome: { ...values.subscriberWelcome, heading: "  So glad to have you  " },
  }
  const payload = formValuesToEmailCopyPayload(emailCopyFormSchema.parse(edited))

  expect(resolveEmailCopy(payload).subscriberWelcome.heading).toBe("So glad to have you")
})

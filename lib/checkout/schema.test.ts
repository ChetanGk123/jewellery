import { expect, test } from "bun:test"
import { checkoutSchema } from "./schema"

const VALID = {
  fullName: "Aisha Verma",
  phone: "9876543210",
  email: "aisha@example.com",
  addressLine: "12 Rose Lane, Malviya Nagar",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302017",
  paymentMethod: "cod" as const,
}

test("checkoutSchema accepts a valid COD order", () => {
  const result = checkoutSchema.safeParse(VALID)
  expect(result.success).toBe(true)
})

test("checkoutSchema trims surrounding whitespace", () => {
  const result = checkoutSchema.safeParse({ ...VALID, city: "  Jaipur  " })
  expect(result.success).toBe(true)
  if (result.success) expect(result.data.city).toBe("Jaipur")
})

test("checkoutSchema rejects a phone that isn't 10 digits", () => {
  const result = checkoutSchema.safeParse({ ...VALID, phone: "12345" })
  expect(result.success).toBe(false)
})

test("checkoutSchema rejects a mobile not starting 6–9", () => {
  const result = checkoutSchema.safeParse({ ...VALID, phone: "1234567890" })
  expect(result.success).toBe(false)
})

test("checkoutSchema rejects a malformed email", () => {
  const result = checkoutSchema.safeParse({ ...VALID, email: "not-an-email" })
  expect(result.success).toBe(false)
})

test("checkoutSchema rejects a PIN code that isn't 6 digits", () => {
  const result = checkoutSchema.safeParse({ ...VALID, pincode: "3020" })
  expect(result.success).toBe(false)
})

test("checkoutSchema rejects an empty name", () => {
  const result = checkoutSchema.safeParse({ ...VALID, fullName: " " })
  expect(result.success).toBe(false)
})

test("checkoutSchema rejects an unknown payment method", () => {
  const result = checkoutSchema.safeParse({ ...VALID, paymentMethod: "card" })
  expect(result.success).toBe(false)
})

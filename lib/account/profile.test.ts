import { describe, expect, test } from "bun:test"
import { profileSchema, profileToCheckoutDefaults, toCustomerProfile } from "./profile"

const row = {
  full_name: "Asha Rao",
  phone: "9812345678",
  address_line: "12 MG Road",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411001",
}

describe("toCustomerProfile", () => {
  test("maps snake_case row to camelCase profile", () => {
    expect(toCustomerProfile(row)).toEqual({
      fullName: "Asha Rao",
      phone: "9812345678",
      addressLine: "12 MG Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
    })
  })
})

describe("profileSchema", () => {
  test("keeps the checkout field constraints (phone, pincode)", () => {
    const profile = toCustomerProfile(row)
    expect(profileSchema.safeParse(profile).success).toBe(true)
    expect(profileSchema.safeParse({ ...profile, phone: "12345" }).success).toBe(false)
    expect(profileSchema.safeParse({ ...profile, pincode: "0001" }).success).toBe(false)
  })

  test("has no email or paymentMethod fields", () => {
    expect(Object.keys(profileSchema.shape).sort()).toEqual([
      "addressLine",
      "city",
      "fullName",
      "phone",
      "pincode",
      "state",
    ])
  })
})

describe("profileToCheckoutDefaults", () => {
  test("merges a saved profile with the account email", () => {
    const defaults = profileToCheckoutDefaults(toCustomerProfile(row), "asha@example.com")
    expect(defaults).toEqual({
      fullName: "Asha Rao",
      phone: "9812345678",
      email: "asha@example.com",
      addressLine: "12 MG Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      paymentMethod: "cod",
    })
  })

  test("falls back to blanks (but keeps email) with no profile", () => {
    const defaults = profileToCheckoutDefaults(null, "new@example.com")
    expect(defaults.email).toBe("new@example.com")
    expect(defaults.fullName).toBe("")
    expect(defaults.paymentMethod).toBe("cod")
  })
})

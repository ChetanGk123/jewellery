import { describe, expect, test } from "bun:test"
import { reviewContactFromRpc } from "./review"

describe("reviewContactFromRpc", () => {
  test("parses a full contact payload", () => {
    // Arrange
    const raw = { name: "Asha Rao", email: "asha@example.com", phone: "9000000002" }

    // Act
    const contact = reviewContactFromRpc(raw)

    // Assert
    expect(contact).toEqual({ name: "Asha Rao", email: "asha@example.com", phone: "9000000002" })
  })

  test("null email/phone (legacy user_id-null review) stay null", () => {
    const contact = reviewContactFromRpc({ name: "Legacy", email: null, phone: null })
    expect(contact).toEqual({ name: "Legacy", email: null, phone: null })
  })

  test("blank strings are treated as missing", () => {
    const contact = reviewContactFromRpc({ name: "X", email: "  ", phone: "" })
    expect(contact).toEqual({ name: "X", email: null, phone: null })
  })

  test("returns null on non-object or malformed payloads", () => {
    expect(reviewContactFromRpc(null)).toBeNull()
    expect(reviewContactFromRpc("nope")).toBeNull()
    expect(reviewContactFromRpc([1, 2])).toBeNull()
    expect(reviewContactFromRpc({ email: "a@b.c" })).toBeNull() // name missing
  })
})

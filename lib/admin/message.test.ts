import { describe, expect, test } from "bun:test"
import { normalizeResolutionNote, RESOLUTION_NOTE_MAX_LEN } from "./message"

describe("normalizeResolutionNote", () => {
  test("trims the note", () => {
    expect(normalizeResolutionNote("  Sent replacement clasp.  ")).toBe("Sent replacement clasp.")
  })

  test("empty or whitespace-only notes are null", () => {
    expect(normalizeResolutionNote("")).toBeNull()
    expect(normalizeResolutionNote("   \n ")).toBeNull()
  })

  test("notes over the cap are null", () => {
    expect(normalizeResolutionNote("x".repeat(RESOLUTION_NOTE_MAX_LEN))).toHaveLength(
      RESOLUTION_NOTE_MAX_LEN,
    )
    expect(normalizeResolutionNote("x".repeat(RESOLUTION_NOTE_MAX_LEN + 1))).toBeNull()
  })
})

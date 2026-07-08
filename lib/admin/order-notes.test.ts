import { describe, expect, test } from "bun:test"
import { NOTE_MAX_LEN, normalizeOrderNote } from "./order-notes"

describe("normalizeOrderNote", () => {
  test("trims surrounding whitespace and returns the note", () => {
    expect(normalizeOrderNote("  deliver after 6pm  ")).toBe("deliver after 6pm")
  })

  test("returns null for empty or whitespace-only input", () => {
    expect(normalizeOrderNote("")).toBeNull()
    expect(normalizeOrderNote("   \n\t ")).toBeNull()
  })

  test("returns null when the trimmed note exceeds the max length", () => {
    expect(normalizeOrderNote("x".repeat(NOTE_MAX_LEN))).toBe("x".repeat(NOTE_MAX_LEN))
    expect(normalizeOrderNote("x".repeat(NOTE_MAX_LEN + 1))).toBeNull()
  })

  test("keeps interior newlines (multi-line notes are fine)", () => {
    expect(normalizeOrderNote("ring bell twice\ncall on arrival")).toBe(
      "ring bell twice\ncall on arrival",
    )
  })
})

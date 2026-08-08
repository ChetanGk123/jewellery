import { expect, test } from "bun:test"
import { parseReviewsPage } from "./listing"

// The `?reviews=` value is untrusted URL input and feeds a PostgREST
// `.range()` offset, where a bad number is a hard error rather than an empty
// result — so every non-positive-integer form must collapse to page 1.

test("reads a positive integer page", () => {
  expect(parseReviewsPage("2")).toBe(2)
  expect(parseReviewsPage("17")).toBe(17)
})

test("falls back to 1 for missing, zero, negative and fractional input", () => {
  expect(parseReviewsPage(undefined)).toBe(1)
  expect(parseReviewsPage("")).toBe(1)
  expect(parseReviewsPage("0")).toBe(1)
  expect(parseReviewsPage("-3")).toBe(1)
  expect(parseReviewsPage("2.5")).toBe(1)
})

test("falls back to 1 for non-numeric and injection-shaped input", () => {
  expect(parseReviewsPage("abc")).toBe(1)
  expect(parseReviewsPage("1; drop table review")).toBe(1)
  expect(parseReviewsPage("Infinity")).toBe(1)
  expect(parseReviewsPage("NaN")).toBe(1)
})

test("takes the first value when the param is repeated", () => {
  expect(parseReviewsPage(["3", "9"])).toBe(3)
  expect(parseReviewsPage([])).toBe(1)
})

import { test, expect } from "bun:test";
import { paiseToRupees, formatPaise, discountPercent } from "./money";

test("paiseToRupees converts integer paise to rupees", () => {
  expect(paiseToRupees(249900)).toBe(2499);
  expect(paiseToRupees(0)).toBe(0);
});

test("formatPaise renders whole rupees with Indian grouping", () => {
  // en-IN groups as 2,499 and 1,00,000
  expect(formatPaise(249900)).toBe("₹2,499");
  expect(formatPaise(10000000)).toBe("₹1,00,000");
});

test("formatPaise shows decimals when the amount has paise", () => {
  expect(formatPaise(249950)).toBe("₹2,499.50");
  expect(formatPaise(249900, { withDecimals: true })).toBe("₹2,499.00");
});

test("discountPercent computes rounded saving, 0 when invalid", () => {
  expect(discountPercent(249900, 349900)).toBe(29);
  expect(discountPercent(249900, 249900)).toBe(0);
  expect(discountPercent(249900, null)).toBe(0);
  expect(discountPercent(249900, 100000)).toBe(0);
});

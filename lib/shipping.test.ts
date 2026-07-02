import { expect, test } from "bun:test";
import {
  FLAT_SHIPPING_PAISE,
  amountToFreeShipPaise,
  qualifiesForFreeShipping,
  shippingPaise,
} from "./shipping";

const THRESHOLD = 99900; // ₹999

test("shippingPaise charges the flat fee below the threshold", () => {
  expect(shippingPaise(50000, THRESHOLD)).toBe(FLAT_SHIPPING_PAISE);
});

test("shippingPaise is free at exactly the threshold", () => {
  expect(shippingPaise(THRESHOLD, THRESHOLD)).toBe(0);
});

test("shippingPaise is free above the threshold", () => {
  expect(shippingPaise(150000, THRESHOLD)).toBe(0);
});

test("shippingPaise is free for an empty cart", () => {
  expect(shippingPaise(0, THRESHOLD)).toBe(0);
});

test("amountToFreeShipPaise returns the remaining spend below the threshold", () => {
  expect(amountToFreeShipPaise(60000, THRESHOLD)).toBe(39900);
});

test("amountToFreeShipPaise is zero once qualified", () => {
  expect(amountToFreeShipPaise(THRESHOLD, THRESHOLD)).toBe(0);
  expect(amountToFreeShipPaise(120000, THRESHOLD)).toBe(0);
});

test("qualifiesForFreeShipping reflects the threshold", () => {
  expect(qualifiesForFreeShipping(0, THRESHOLD)).toBe(false);
  expect(qualifiesForFreeShipping(50000, THRESHOLD)).toBe(false);
  expect(qualifiesForFreeShipping(THRESHOLD, THRESHOLD)).toBe(true);
  expect(qualifiesForFreeShipping(120000, THRESHOLD)).toBe(true);
});

import { test, expect } from "bun:test";
import {
  addLine,
  cartCount,
  cartLineId,
  cartMrpTotalPaise,
  cartSavingsPaise,
  cartSubtotalPaise,
  removeLine,
  setLineQuantity,
  MAX_LINE_QUANTITY,
  type CartLine,
  type CartLineInput,
} from "./cart";

/** A minimal line input; override fields per test. */
function makeInput(overrides: Partial<CartLineInput> = {}): CartLineInput {
  return {
    productId: "p1",
    slug: "kundan-set",
    name: "Kundan Bridal Set",
    categoryName: "Bridal Sets",
    pricePaise: 249900,
    mrpPaise: 349900,
    imageUrl: null,
    imageBg: "linear-gradient(#fff,#000)",
    optionLabel: null,
    optionValue: null,
    ...overrides,
  };
}

test("cartLineId keys by product, disambiguated by variant", () => {
  expect(cartLineId("p1")).toBe("p1");
  expect(cartLineId("p1", null)).toBe("p1");
  expect(cartLineId("p1", "rose")).toBe("p1:rose");
});

test("addLine appends a new line with a derived id and default qty 1", () => {
  const lines = addLine([], makeInput());
  expect(lines).toHaveLength(1);
  expect(lines[0].id).toBe("p1");
  expect(lines[0].quantity).toBe(1);
});

test("addLine merges quantity for the same product+variant", () => {
  const first = addLine([], makeInput(), 2);
  const second = addLine(first, makeInput(), 3);
  expect(second).toHaveLength(1);
  expect(second[0].quantity).toBe(5);
});

test("addLine keeps distinct variants of the same product as separate lines", () => {
  const gold = addLine([], makeInput({ optionValue: "gold", optionLabel: "Gold" }));
  const both = addLine(gold, makeInput({ optionValue: "rose", optionLabel: "Rose" }));
  expect(both).toHaveLength(2);
  expect(both.map((l) => l.id)).toEqual(["p1:gold", "p1:rose"]);
});

test("addLine caps a merged quantity at MAX_LINE_QUANTITY", () => {
  const lines = addLine(addLine([], makeInput(), 8), makeInput(), 8);
  expect(lines[0].quantity).toBe(MAX_LINE_QUANTITY);
});

test("addLine does not mutate the input array", () => {
  const original: CartLine[] = [];
  const next = addLine(original, makeInput());
  expect(original).toHaveLength(0);
  expect(next).not.toBe(original);
});

test("setLineQuantity sets an exact clamped quantity", () => {
  const lines = addLine([], makeInput());
  expect(setLineQuantity(lines, "p1", 4)[0].quantity).toBe(4);
  expect(setLineQuantity(lines, "p1", 99)[0].quantity).toBe(MAX_LINE_QUANTITY);
});

test("setLineQuantity removes the line when quantity drops to 0 or below", () => {
  const lines = addLine([], makeInput());
  expect(setLineQuantity(lines, "p1", 0)).toHaveLength(0);
  expect(setLineQuantity(lines, "p1", -3)).toHaveLength(0);
});

test("removeLine drops only the matching line", () => {
  const two = addLine(addLine([], makeInput()), makeInput({ productId: "p2" }));
  const left = removeLine(two, "p1");
  expect(left).toHaveLength(1);
  expect(left[0].productId).toBe("p2");
});

test("cartCount sums units across all lines", () => {
  const lines = addLine(addLine([], makeInput(), 2), makeInput({ productId: "p2" }), 3);
  expect(cartCount(lines)).toBe(5);
  expect(cartCount([])).toBe(0);
});

test("cartSubtotalPaise sums price × quantity", () => {
  const lines = addLine([], makeInput({ pricePaise: 100000 }), 3);
  expect(cartSubtotalPaise(lines)).toBe(300000);
});

test("cartMrpTotalPaise falls back to price when a line has no MRP", () => {
  const withMrp = addLine([], makeInput({ pricePaise: 100000, mrpPaise: 150000 }), 2);
  expect(cartMrpTotalPaise(withMrp)).toBe(300000);
  const noMrp = addLine([], makeInput({ pricePaise: 100000, mrpPaise: null }), 2);
  expect(cartMrpTotalPaise(noMrp)).toBe(200000);
});

test("cartSavingsPaise is the non-negative MRP-vs-price gap", () => {
  const lines = addLine([], makeInput({ pricePaise: 100000, mrpPaise: 150000 }), 2);
  expect(cartSavingsPaise(lines)).toBe(100000);
  const noSaving = addLine([], makeInput({ pricePaise: 100000, mrpPaise: null }), 2);
  expect(cartSavingsPaise(noSaving)).toBe(0);
});

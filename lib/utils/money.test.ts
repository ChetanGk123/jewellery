import { test, expect } from "bun:test"
import {
  paiseToRupees,
  formatPaise,
  discountPercent,
  pricePairFromRupees,
  rupeesFromPricePair,
} from "./money"

test("paiseToRupees converts integer paise to rupees", () => {
  expect(paiseToRupees(249900)).toBe(2499)
  expect(paiseToRupees(0)).toBe(0)
})

test("formatPaise renders whole rupees with Indian grouping", () => {
  // en-IN groups as 2,499 and 1,00,000
  expect(formatPaise(249900)).toBe("₹2,499")
  expect(formatPaise(10000000)).toBe("₹1,00,000")
})

test("formatPaise shows decimals when the amount has paise", () => {
  expect(formatPaise(249950)).toBe("₹2,499.50")
  expect(formatPaise(249900, { withDecimals: true })).toBe("₹2,499.00")
})

test("discountPercent computes rounded saving, 0 when invalid", () => {
  expect(discountPercent(249900, 349900)).toBe(29)
  expect(discountPercent(249900, 249900)).toBe(0)
  expect(discountPercent(249900, null)).toBe(0)
  expect(discountPercent(249900, 100000)).toBe(0)
})

test("pricePairFromRupees: valid sale becomes price, price becomes MRP", () => {
  expect(pricePairFromRupees(3499, 2499)).toEqual({ pricePaise: 249900, mrpPaise: 349900 })
  // No sale, sale of 0, or sale >= price → price charged, no MRP.
  expect(pricePairFromRupees(3499, null)).toEqual({ pricePaise: 349900, mrpPaise: null })
  expect(pricePairFromRupees(3499, 0)).toEqual({ pricePaise: 349900, mrpPaise: null })
  expect(pricePairFromRupees(3499, 3499)).toEqual({ pricePaise: 349900, mrpPaise: null })
  expect(pricePairFromRupees(3499, 4000)).toEqual({ pricePaise: 349900, mrpPaise: null })
  // Fractional rupees round to the nearest paisa.
  expect(pricePairFromRupees(99.995, null)).toEqual({ pricePaise: 10000, mrpPaise: null })
})

test("rupeesFromPricePair inverts pricePairFromRupees", () => {
  expect(rupeesFromPricePair(249900, 349900)).toEqual({ priceRupees: 3499, saleRupees: 2499 })
  expect(rupeesFromPricePair(349900, null)).toEqual({ priceRupees: 3499, saleRupees: null })
  // Degenerate stored state (MRP <= price) exports as a plain price.
  expect(rupeesFromPricePair(349900, 349900)).toEqual({ priceRupees: 3499, saleRupees: null })

  // Round-trip property over representative pairs.
  const pairs: Array<[number, number | null]> = [
    [3499, 2499],
    [3499, null],
    [149, 99],
    [100000, 79999.5],
  ]
  for (const [price, sale] of pairs) {
    const stored = pricePairFromRupees(price, sale)
    const back = rupeesFromPricePair(stored.pricePaise, stored.mrpPaise)
    expect(pricePairFromRupees(back.priceRupees, back.saleRupees)).toEqual(stored)
  }
})

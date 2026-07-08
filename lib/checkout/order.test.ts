import { describe, expect, test } from "bun:test"
import type { CartLine } from "@/lib/cart"
import {
  cartLinesToOrderItems,
  orderItemsSchema,
  toOrderConfirmation,
  toPlacedOrder,
} from "./order"

const UUID_A = "11111111-1111-4111-8111-111111111111"
const UUID_B = "22222222-2222-4222-8222-222222222222"

function line(overrides: Partial<CartLine>): CartLine {
  return {
    id: UUID_A,
    productId: UUID_A,
    slug: "kundan-rani-haar",
    name: "Kundan Rani Haar Set",
    categoryName: "Necklaces",
    pricePaise: 249900,
    mrpPaise: 299900,
    imageUrl: null,
    imageBg: null,
    optionLabel: "Plating",
    optionValue: "Gold",
    quantity: 1,
    ...overrides,
  }
}

describe("cartLinesToOrderItems", () => {
  test("maps productId, optionValue→tone, and quantity — never a price", () => {
    const items = cartLinesToOrderItems([
      line({ productId: UUID_A, optionValue: "Gold", quantity: 2 }),
      line({ id: UUID_B, productId: UUID_B, optionValue: null, quantity: 3 }),
    ])

    expect(items).toEqual([
      { productId: UUID_A, tone: "Gold", qty: 2 },
      { productId: UUID_B, tone: null, qty: 3 },
    ])
    // The payload must not leak any price/total — the server re-prices.
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(["productId", "qty", "tone"])
    }
  })

  test("empty cart maps to an empty array (rejected by the schema)", () => {
    expect(cartLinesToOrderItems([])).toEqual([])
    expect(orderItemsSchema.safeParse([]).success).toBe(false)
  })
})

describe("orderItemsSchema", () => {
  test("accepts a valid item list", () => {
    const result = orderItemsSchema.safeParse([{ productId: UUID_A, tone: "Gold", qty: 1 }])
    expect(result.success).toBe(true)
  })

  test("rejects a non-uuid product id", () => {
    const result = orderItemsSchema.safeParse([{ productId: "not-a-uuid", tone: null, qty: 1 }])
    expect(result.success).toBe(false)
  })

  test("rejects quantity out of the 1–10 range", () => {
    expect(orderItemsSchema.safeParse([{ productId: UUID_A, tone: null, qty: 0 }]).success).toBe(
      false,
    )
    expect(orderItemsSchema.safeParse([{ productId: UUID_A, tone: null, qty: 11 }]).success).toBe(
      false,
    )
  })

  test("rejects a fractional quantity", () => {
    expect(orderItemsSchema.safeParse([{ productId: UUID_A, tone: null, qty: 1.5 }]).success).toBe(
      false,
    )
  })
})

describe("toPlacedOrder", () => {
  test("narrows a valid RPC return into camelCase PlacedOrder", () => {
    const order = toPlacedOrder({
      order_no: "JR-260703-1001-7F3A",
      subtotal_paise: 209600,
      discount_paise: 41920,
      shipping_paise: 0,
      total_paise: 167680,
      coupon_dropped: false,
    })
    expect(order).toEqual({
      orderNo: "JR-260703-1001-7F3A",
      subtotalPaise: 209600,
      discountPaise: 41920,
      shippingPaise: 0,
      totalPaise: 167680,
      couponDropped: false,
    })
  })

  test("defaults couponDropped to false when the field is absent", () => {
    const order = toPlacedOrder({
      order_no: "JR-260703-1001-7F3A",
      subtotal_paise: 1,
      discount_paise: 0,
      shipping_paise: 0,
      total_paise: 1,
    })
    expect(order?.couponDropped).toBe(false)
  })

  test("carries couponDropped=true when the RPC reports a dropped coupon", () => {
    const order = toPlacedOrder({
      order_no: "JR-260703-1001-7F3A",
      subtotal_paise: 1,
      discount_paise: 0,
      shipping_paise: 0,
      total_paise: 1,
      coupon_dropped: true,
    })
    expect(order?.couponDropped).toBe(true)
  })

  test("returns null when the shape is unexpected", () => {
    expect(toPlacedOrder(null)).toBeNull()
    expect(toPlacedOrder({ order_no: "JR-1" })).toBeNull()
    // A missing money field fails even with a valid order number.
    expect(
      toPlacedOrder({
        order_no: "JR-260703-1001-7F3A",
        subtotal_paise: 1,
        discount_paise: 0,
        shipping_paise: 0,
      }),
    ).toBeNull()
  })
})

describe("toOrderConfirmation", () => {
  test("narrows a valid RPC return into camelCase OrderConfirmation", () => {
    const confirmation = toOrderConfirmation({
      order_no: "JR-260703-1001",
      status: "Pending",
      payment_method: "cod",
      customer_email: "buyer@example.com",
      total_paise: 167680,
      created_at: "2026-07-03T05:00:00+00:00",
    })
    expect(confirmation).toEqual({
      orderNo: "JR-260703-1001",
      status: "Pending",
      paymentMethod: "cod",
      customerEmail: "buyer@example.com",
      totalPaise: 167680,
      createdAt: "2026-07-03T05:00:00+00:00",
    })
  })

  test("returns null for a missing order (null) or partial shape", () => {
    expect(toOrderConfirmation(null)).toBeNull()
    expect(toOrderConfirmation({ order_no: "JR-1" })).toBeNull()
  })
})

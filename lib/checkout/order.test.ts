import { describe, expect, test } from "bun:test";
import type { CartLine } from "@/lib/cart";
import {
  cartLinesToOrderItems,
  orderItemsSchema,
  toPlacedOrder,
} from "./order";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

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
  };
}

describe("cartLinesToOrderItems", () => {
  test("maps productId, optionValue→tone, and quantity — never a price", () => {
    const items = cartLinesToOrderItems([
      line({ productId: UUID_A, optionValue: "Gold", quantity: 2 }),
      line({ id: UUID_B, productId: UUID_B, optionValue: null, quantity: 3 }),
    ]);

    expect(items).toEqual([
      { productId: UUID_A, tone: "Gold", qty: 2 },
      { productId: UUID_B, tone: null, qty: 3 },
    ]);
    // The payload must not leak any price/total — the server re-prices.
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(["productId", "qty", "tone"]);
    }
  });

  test("empty cart maps to an empty array (rejected by the schema)", () => {
    expect(cartLinesToOrderItems([])).toEqual([]);
    expect(orderItemsSchema.safeParse([]).success).toBe(false);
  });
});

describe("orderItemsSchema", () => {
  test("accepts a valid item list", () => {
    const result = orderItemsSchema.safeParse([
      { productId: UUID_A, tone: "Gold", qty: 1 },
    ]);
    expect(result.success).toBe(true);
  });

  test("rejects a non-uuid product id", () => {
    const result = orderItemsSchema.safeParse([
      { productId: "not-a-uuid", tone: null, qty: 1 },
    ]);
    expect(result.success).toBe(false);
  });

  test("rejects quantity out of the 1–10 range", () => {
    expect(
      orderItemsSchema.safeParse([{ productId: UUID_A, tone: null, qty: 0 }])
        .success,
    ).toBe(false);
    expect(
      orderItemsSchema.safeParse([{ productId: UUID_A, tone: null, qty: 11 }])
        .success,
    ).toBe(false);
  });

  test("rejects a fractional quantity", () => {
    expect(
      orderItemsSchema.safeParse([{ productId: UUID_A, tone: null, qty: 1.5 }])
        .success,
    ).toBe(false);
  });
});

describe("toPlacedOrder", () => {
  test("narrows a valid RPC return into camelCase PlacedOrder", () => {
    const order = toPlacedOrder({
      order_no: "JR-260703-1001",
      subtotal_paise: 209600,
      discount_paise: 41920,
      shipping_paise: 0,
      total_paise: 167680,
    });
    expect(order).toEqual({
      orderNo: "JR-260703-1001",
      subtotalPaise: 209600,
      discountPaise: 41920,
      shippingPaise: 0,
      totalPaise: 167680,
    });
  });

  test("returns null when the shape is unexpected", () => {
    expect(toPlacedOrder(null)).toBeNull();
    expect(toPlacedOrder({ order_no: "JR-1" })).toBeNull();
    expect(
      toPlacedOrder({
        order_no: "",
        subtotal_paise: 1,
        discount_paise: 0,
        shipping_paise: 0,
        total_paise: 1,
      }),
    ).toBeNull();
  });
});

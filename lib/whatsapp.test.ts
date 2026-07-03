import { describe, expect, test } from "bun:test";
import type { CartLine } from "@/lib/cart";
import { STORE_INFO } from "@/lib/store-info";
import {
  cartEnquiryMessage,
  cartEnquiryUrl,
  productEnquiryMessage,
  productEnquiryUrl,
  whatsappUrl,
} from "./whatsapp";

const PREFIX = `https://wa.me/${STORE_INFO.whatsapp.number}?text=`;

function line(overrides: Partial<CartLine>): CartLine {
  return {
    id: "l1",
    productId: "p1",
    slug: "polki-choker-set",
    name: "Polki Choker Necklace Set",
    categoryName: "Bridal Sets",
    pricePaise: 329900,
    mrpPaise: 419900,
    imageUrl: null,
    imageBg: null,
    optionLabel: null,
    optionValue: null,
    quantity: 1,
    ...overrides,
  };
}

describe("whatsappUrl", () => {
  test("points at the store number and URL-encodes the message", () => {
    const url = whatsappUrl("Hi & bye");
    expect(url).toBe(`${PREFIX}Hi%20%26%20bye`);
    // Round-trips back to the original message.
    expect(decodeURIComponent(url.slice(PREFIX.length))).toBe("Hi & bye");
  });
});

describe("productEnquiryMessage", () => {
  test("names the product", () => {
    expect(productEnquiryMessage({ name: "Kundan Rani Haar" })).toBe(
      `Hi ${STORE_INFO.name}, I'm interested in the Kundan Rani Haar.`,
    );
  });

  test("appends the plating tone when one is chosen", () => {
    expect(productEnquiryMessage({ name: "Kundan Rani Haar", tone: "Gold" })).toBe(
      `Hi ${STORE_INFO.name}, I'm interested in the Kundan Rani Haar (Gold plating).`,
    );
  });

  test("appends the product link on its own line when provided", () => {
    expect(
      productEnquiryMessage({
        name: "Kundan Rani Haar",
        tone: "Gold",
        url: "https://shop.example/product/kundan-rani-haar",
      }),
    ).toBe(
      `Hi ${STORE_INFO.name}, I'm interested in the Kundan Rani Haar (Gold plating).\nhttps://shop.example/product/kundan-rani-haar`,
    );
  });

  test("omits tone/link for falsy values", () => {
    const message = productEnquiryMessage({ name: "Anklet", tone: "", url: null });
    expect(message).not.toContain("plating");
    expect(message).toBe(`Hi ${STORE_INFO.name}, I'm interested in the Anklet.`);
  });
});

describe("productEnquiryUrl", () => {
  test("encodes the enquiry message into a wa.me link", () => {
    const enquiry = {
      name: "Kundan Rani Haar",
      tone: "Gold",
      url: "https://shop.example/product/kundan-rani-haar",
    };
    const url = productEnquiryUrl(enquiry);
    expect(url.startsWith(PREFIX)).toBe(true);
    expect(decodeURIComponent(url.slice(PREFIX.length))).toBe(
      productEnquiryMessage(enquiry),
    );
  });
});

describe("cartEnquiryMessage", () => {
  test("lists each line with qty, tone, and unit price, then the subtotal", () => {
    const message = cartEnquiryMessage([
      line({ name: "Bridal Combo", pricePaise: 499900, optionValue: "Gold", quantity: 1 }),
      line({ name: "Polki Choker", pricePaise: 329900, optionValue: null, quantity: 2 }),
    ]);
    expect(message).toContain("• 1× Bridal Combo (Gold) — ₹4,999");
    expect(message).toContain("• 2× Polki Choker — ₹3,299");
    // Subtotal = 499900 + 329900*2 = 1159700.
    expect(message).toContain("Subtotal: ₹11,597");
  });
});

describe("cartEnquiryUrl", () => {
  test("encodes the cart enquiry into a wa.me link", () => {
    const lines = [line({ quantity: 2 })];
    const url = cartEnquiryUrl(lines);
    expect(url.startsWith(PREFIX)).toBe(true);
    expect(decodeURIComponent(url.slice(PREFIX.length))).toBe(
      cartEnquiryMessage(lines),
    );
  });
});

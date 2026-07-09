import { describe, expect, test } from "bun:test"
import type { CartLine } from "@/lib/cart"
import { STORE_INFO } from "@/lib/store-info"
import {
  cartEnquiryMessage,
  cartEnquiryUrl,
  codConfirmationMessage,
  customerWhatsappUrl,
  productEnquiryMessage,
  reviewContactMessage,
  productEnquiryUrl,
  whatsappUrl,
} from "./whatsapp"

const PREFIX = `https://wa.me/${STORE_INFO.whatsapp.number}?text=`

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
  }
}

describe("whatsappUrl", () => {
  test("points at the store number and URL-encodes the message", () => {
    const url = whatsappUrl("Hi & bye")
    expect(url).toBe(`${PREFIX}Hi%20%26%20bye`)
    // Round-trips back to the original message.
    expect(decodeURIComponent(url.slice(PREFIX.length))).toBe("Hi & bye")
  })
})

describe("productEnquiryMessage", () => {
  test("names the product", () => {
    expect(productEnquiryMessage({ name: "Kundan Rani Haar" })).toBe(
      `Hi ${STORE_INFO.name}, I'm interested in the Kundan Rani Haar.`,
    )
  })

  test("appends the plating tone when one is chosen", () => {
    expect(productEnquiryMessage({ name: "Kundan Rani Haar", tone: "Gold" })).toBe(
      `Hi ${STORE_INFO.name}, I'm interested in the Kundan Rani Haar (Gold plating).`,
    )
  })

  test("appends the product link on its own line when provided", () => {
    expect(
      productEnquiryMessage({
        name: "Kundan Rani Haar",
        tone: "Gold",
        url: "https://shop.example/product/kundan-rani-haar",
      }),
    ).toBe(
      `Hi ${STORE_INFO.name}, I'm interested in the Kundan Rani Haar (Gold plating).\nhttps://shop.example/product/kundan-rani-haar`,
    )
  })

  test("omits tone/link for falsy values", () => {
    const message = productEnquiryMessage({ name: "Anklet", tone: "", url: null })
    expect(message).not.toContain("plating")
    expect(message).toBe(`Hi ${STORE_INFO.name}, I'm interested in the Anklet.`)
  })
})

describe("productEnquiryUrl", () => {
  test("encodes the enquiry message into a wa.me link", () => {
    const enquiry = {
      name: "Kundan Rani Haar",
      tone: "Gold",
      url: "https://shop.example/product/kundan-rani-haar",
    }
    const url = productEnquiryUrl(enquiry)
    expect(url.startsWith(PREFIX)).toBe(true)
    expect(decodeURIComponent(url.slice(PREFIX.length))).toBe(productEnquiryMessage(enquiry))
  })
})

describe("cartEnquiryMessage", () => {
  test("lists each line with qty, tone, and unit price, then the subtotal", () => {
    const message = cartEnquiryMessage([
      line({ name: "Bridal Combo", pricePaise: 499900, optionValue: "Gold", quantity: 1 }),
      line({ name: "Polki Choker", pricePaise: 329900, optionValue: null, quantity: 2 }),
    ])
    expect(message).toContain("• 1× Bridal Combo (Gold) — ₹4,999")
    expect(message).toContain("• 2× Polki Choker — ₹3,299")
    // Subtotal = 499900 + 329900*2 = 1159700.
    expect(message).toContain("Subtotal: ₹11,597")
  })
})

describe("codConfirmationMessage", () => {
  test("names the customer, order number, and COD total, and asks for a YES", () => {
    const message = codConfirmationMessage({
      customerName: "Asha Kapoor",
      orderNo: "RJ-1024",
      totalPaise: 778000,
    })
    expect(message).toContain("Asha Kapoor")
    expect(message).toContain("RJ-1024")
    expect(message).toContain("₹7,780")
    expect(message).toContain("Cash on Delivery")
    expect(message).toContain(STORE_INFO.name)
    expect(message).toContain("YES")
  })
})

describe("customerWhatsappUrl", () => {
  test("builds a wa.me link to a 10-digit local number with the 91 country code", () => {
    const url = customerWhatsappUrl("99727 77455", "Namaste")
    expect(url).toBe("https://wa.me/919972777455?text=Namaste")
  })

  test("keeps an already-international number as-is", () => {
    const url = customerWhatsappUrl("+91 99727 77455", "Hi")
    expect(url).toBe("https://wa.me/919972777455?text=Hi")
  })

  test("URL-encodes the message", () => {
    const url = customerWhatsappUrl("9972777455", "Order RJ-1 & ₹100") ?? ""
    const encoded = url.slice(url.indexOf("?text=") + "?text=".length)
    expect(decodeURIComponent(encoded)).toBe("Order RJ-1 & ₹100")
  })

  test("returns null when the phone has no usable digits", () => {
    expect(customerWhatsappUrl("", "Hi")).toBeNull()
    expect(customerWhatsappUrl("n/a", "Hi")).toBeNull()
  })
})

describe("cartEnquiryUrl", () => {
  test("encodes the cart enquiry into a wa.me link", () => {
    const lines = [line({ quantity: 2 })]
    const url = cartEnquiryUrl(lines)
    expect(url.startsWith(PREFIX)).toBe(true)
    expect(decodeURIComponent(url.slice(PREFIX.length))).toBe(cartEnquiryMessage(lines))
  })
})

describe("reviewContactMessage", () => {
  test("names the reviewer, the product, and the store (6.12)", () => {
    const message = reviewContactMessage({
      reviewerName: "Asha Kapoor",
      productName: "Polki Choker Necklace Set",
    })
    expect(message).toContain("Asha Kapoor")
    expect(message).toContain("Polki Choker Necklace Set")
    expect(message).toContain(STORE_INFO.name)
  })
})

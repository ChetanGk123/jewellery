import { expect, test } from "bun:test"
import { buildAbandonedCartEmail, type AbandonedCartEmailInput } from "./abandoned-cart"
import { resolveStoreInfo } from "@/lib/store-info"

const base: AbandonedCartEmailInput = {
  items: [
    {
      name: "Polki Choker Necklace Set",
      qty: 2,
      unitPricePaise: 499900,
      tone: "Gold",
      productUrl: "https://shop.example/product/polki-choker",
    },
    { name: "Kundan Jhumkas", qty: 1, unitPricePaise: 150000, tone: null, productUrl: null },
  ],
  cartUrl: "https://shop.example/cart",
}

test("names the items, quantities, INR totals and the cart link in both bodies", () => {
  const msg = buildAbandonedCartEmail(base)

  for (const body of [msg.html, msg.text]) {
    expect(body).toContain("Polki Choker Necklace Set")
    expect(body).toContain("Kundan Jhumkas")
    expect(body).toContain("×2")
    // Cart total = 499900×2 + 150000 = 1149800 paise.
    expect(body).toContain("₹11,498")
    expect(body).toContain("https://shop.example/cart")
  }
  expect(msg.html).toContain("https://shop.example/product/polki-choker")
})

test("HTML-escapes item names", () => {
  const msg = buildAbandonedCartEmail({
    ...base,
    items: [{ name: "<b>Choker</b>", qty: 1, unitPricePaise: 100, tone: null, productUrl: null }],
  })
  expect(msg.html).not.toContain("<b>Choker</b>")
  expect(msg.html).toContain("&lt;b&gt;Choker&lt;/b&gt;")
})

test("a resolved store info overrides the brand (6.15 pattern)", () => {
  const msg = buildAbandonedCartEmail(base, resolveStoreInfo({ storeName: "Meera Jewels" }))
  expect(msg.subject).toContain("Meera Jewels")
  expect(msg.html).toContain("MEERA JEWELS")
})

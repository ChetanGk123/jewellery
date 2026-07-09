import { expect, test } from "bun:test"
import { buildSubscriberWelcomeEmail } from "./subscriber-welcome"
import { resolveStoreInfo } from "@/lib/store-info"

test("welcomes the subscriber and links to the shop", () => {
  const msg = buildSubscriberWelcomeEmail({ shopUrl: "https://shop.example/shop" })

  expect(msg.subject.toLowerCase()).toContain("welcome")
  for (const body of [msg.html, msg.text]) {
    expect(body).toContain("https://shop.example/shop")
  }
})

test("a resolved store info overrides the brand", () => {
  const msg = buildSubscriberWelcomeEmail(
    { shopUrl: "https://shop.example/shop" },
    resolveStoreInfo({ storeName: "Meera Jewels" }),
  )
  expect(msg.subject).toContain("Meera Jewels")
  expect(msg.html).toContain("MEERA JEWELS")
})

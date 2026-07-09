import { expect, test } from "bun:test"
import { resolveEmailCopy } from "./copy"
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

test("custom copy overrides subject, heading, body and button (7.2)", () => {
  const copy = resolveEmailCopy({
    subscriberWelcome: {
      subject: "You're on the {storeName} list",
      heading: "So glad to have you here",
      body: "Expect {storeName} updates only when they matter.",
      button: "See new arrivals",
    },
  }).subscriberWelcome

  const msg = buildSubscriberWelcomeEmail({ shopUrl: "https://shop.example/shop" }, undefined, copy)

  expect(msg.subject).toBe("You're on the RJ Jewellers list")
  expect(msg.html).toContain("So glad to have you here")
  expect(msg.html).toContain("See new arrivals")
  for (const body of [msg.html, msg.text]) {
    expect(body).toContain("Expect RJ Jewellers updates only when they matter.")
  }
})

test("hostile saved copy renders escaped (7.2)", () => {
  const copy = resolveEmailCopy({
    subscriberWelcome: { body: "<script>x</script> welcome" },
  }).subscriberWelcome
  const msg = buildSubscriberWelcomeEmail({ shopUrl: "https://x.example" }, undefined, copy)
  expect(msg.html).not.toContain("<script>")
  expect(msg.html).toContain("&lt;script&gt;")
})

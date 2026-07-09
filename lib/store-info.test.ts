import { describe, expect, test } from "bun:test"
import { resolveStoreInfo, STORE_INFO } from "./store-info"

describe("resolveStoreInfo", () => {
  test("with no overrides, returns the STORE_INFO const values", () => {
    const r = resolveStoreInfo({})
    expect(r.name).toBe(STORE_INFO.name)
    expect(r.tagline).toBe(STORE_INFO.tagline)
    expect(r.phone.display).toBe(STORE_INFO.phone.display)
    expect(r.phone.href).toBe(STORE_INFO.phone.href)
    expect(r.whatsapp.number).toBe(STORE_INFO.whatsapp.number)
    expect(r.email.display).toBe(STORE_INFO.email.display)
    expect(r.address.line).toBe(STORE_INFO.address.line)
    expect(r.socials).toEqual(STORE_INFO.socials)
    expect(r.gstin).toBeNull()
  })

  test("scalar columns win over the const for name/email/phone/gstin", () => {
    const r = resolveStoreInfo({
      storeName: "Meena Jewels",
      supportEmail: "hello@meena.in",
      phone: "+91 90000 11111",
      gstin: "29ABCDE1234F1Z5",
    })
    expect(r.name).toBe("Meena Jewels")
    expect(r.email.display).toBe("hello@meena.in")
    expect(r.email.href).toBe("mailto:hello@meena.in")
    expect(r.phone.display).toBe("+91 90000 11111")
    expect(r.gstin).toBe("29ABCDE1234F1Z5")
  })

  test("wordmark defaults to the uppercased name unless overridden in the blob", () => {
    expect(resolveStoreInfo({ storeName: "Meena Jewels" }).wordmark).toBe("MEENA JEWELS")
    expect(
      resolveStoreInfo({ storeName: "Meena Jewels", storeInfo: { wordmark: "MEENA" } }).wordmark,
    ).toBe("MEENA")
  })

  test("phone href derives tel: from the display digits", () => {
    const r = resolveStoreInfo({ phone: "+91 90000 11111" })
    expect(r.phone.href).toBe("tel:+919000011111")
  })

  test("blank/whitespace scalar overrides fall back to the const (never blank the site)", () => {
    const r = resolveStoreInfo({ storeName: "   ", supportEmail: "", phone: null })
    expect(r.name).toBe(STORE_INFO.name)
    expect(r.email.display).toBe(STORE_INFO.email.display)
    expect(r.phone.display).toBe(STORE_INFO.phone.display)
  })

  test("blob overrides descriptor/tagline/address/hours", () => {
    const r = resolveStoreInfo({
      storeInfo: {
        descriptor: "Fine Temple Jewellery",
        tagline: "Since 1990.",
        address: { line: "12 MG Road", city: "Bengaluru", state: "Karnataka", note: "Walk-ins ok" },
        hours: { short: "Daily 11–8", long: "Every day 11:00–20:00", note: "Closed Diwali" },
      },
    })
    expect(r.descriptor).toBe("Fine Temple Jewellery")
    expect(r.tagline).toBe("Since 1990.")
    expect(r.address).toEqual({
      line: "12 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      note: "Walk-ins ok",
    })
    expect(r.hours.short).toBe("Daily 11–8")
  })

  test("partial blob address keeps the const for missing keys", () => {
    const r = resolveStoreInfo({ storeInfo: { address: { city: "Surat" } } })
    expect(r.address.city).toBe("Surat")
    expect(r.address.state).toBe(STORE_INFO.address.state)
    expect(r.address.line).toBe(STORE_INFO.address.line)
  })

  test("whatsapp number from the blob drives its href; default is the const", () => {
    const r = resolveStoreInfo({ storeInfo: { whatsappE164: "919812345678" } })
    expect(r.whatsapp.number).toBe("919812345678")
    expect(r.whatsapp.href).toBe("https://wa.me/919812345678")
  })

  test("the default WhatsApp social badge follows the resolved number", () => {
    const r = resolveStoreInfo({ storeInfo: { whatsappE164: "919812345678" } })
    const badge = r.socials.find((s) => s.label === "WhatsApp")
    expect(badge?.href).toBe("https://wa.me/919812345678")
  })

  test("socials from the blob replace the const list when a valid array is given", () => {
    const socials = [{ label: "Instagram", glyph: "IG", href: "https://instagram.com/x" }]
    const r = resolveStoreInfo({ storeInfo: { socials } })
    expect(r.socials).toEqual(socials)
  })

  test("malformed blob is ignored (falls back to the const)", () => {
    expect(resolveStoreInfo({ storeInfo: "nonsense" }).tagline).toBe(STORE_INFO.tagline)
    expect(resolveStoreInfo({ storeInfo: [1, 2, 3] }).descriptor).toBe(STORE_INFO.descriptor)
    expect(resolveStoreInfo({ storeInfo: { socials: "bad" } }).socials).toEqual(STORE_INFO.socials)
  })
})

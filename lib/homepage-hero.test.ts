import { describe, expect, test } from "bun:test"
import { DEFAULT_HERO_SETTINGS, heroSettingsToBlob, resolveHeroSettings } from "./homepage-hero"

describe("resolveHeroSettings", () => {
  test("reads image_url from a saved blob", () => {
    const raw = { image_url: "https://x.supabase.co/storage/v1/object/public/product-images/branding/a.jpg" }

    const settings = resolveHeroSettings(raw)

    expect(settings.imageUrl).toBe(raw.image_url)
  })

  test("returns the default (no image) for an empty blob", () => {
    expect(resolveHeroSettings({})).toEqual(DEFAULT_HERO_SETTINGS)
    expect(resolveHeroSettings({}).imageUrl).toBeNull()
  })

  test("tolerates non-object shapes (0042 lesson: never throw)", () => {
    expect(resolveHeroSettings(null)).toEqual(DEFAULT_HERO_SETTINGS)
    expect(resolveHeroSettings(undefined)).toEqual(DEFAULT_HERO_SETTINGS)
    expect(resolveHeroSettings("nope")).toEqual(DEFAULT_HERO_SETTINGS)
    expect(resolveHeroSettings(42)).toEqual(DEFAULT_HERO_SETTINGS)
    expect(resolveHeroSettings([{ image_url: "x" }])).toEqual(DEFAULT_HERO_SETTINGS)
  })

  test("treats blank or non-string image_url as unset", () => {
    expect(resolveHeroSettings({ image_url: "" }).imageUrl).toBeNull()
    expect(resolveHeroSettings({ image_url: "   " }).imageUrl).toBeNull()
    expect(resolveHeroSettings({ image_url: 7 }).imageUrl).toBeNull()
    expect(resolveHeroSettings({ image_url: null }).imageUrl).toBeNull()
  })
})

describe("heroSettingsToBlob", () => {
  test("maps imageUrl to the snake_case blob key", () => {
    expect(heroSettingsToBlob({ imageUrl: "https://example.com/a.jpg" })).toEqual({
      image_url: "https://example.com/a.jpg",
    })
  })

  test("stores an empty string when no image is set", () => {
    expect(heroSettingsToBlob({ imageUrl: null })).toEqual({ image_url: "" })
  })

  test("round-trips through resolve", () => {
    const settings = { imageUrl: "https://example.com/hero.webp" }

    expect(resolveHeroSettings(heroSettingsToBlob(settings))).toEqual(settings)
    expect(resolveHeroSettings(heroSettingsToBlob({ imageUrl: null }))).toEqual({ imageUrl: null })
  })
})

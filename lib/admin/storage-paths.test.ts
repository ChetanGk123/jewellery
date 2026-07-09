import { describe, expect, test } from "bun:test"
import { storagePathFromPublicUrl } from "./storage-paths"

const BASE = "https://abc.supabase.co/storage/v1/object/public/product-images/"

describe("storagePathFromPublicUrl", () => {
  test("extracts the object path from a bucket public URL", () => {
    expect(storagePathFromPublicUrl(`${BASE}products/1b2c.jpg`)).toBe("products/1b2c.jpg")
    expect(storagePathFromPublicUrl(`${BASE}categories/9f.webp`)).toBe("categories/9f.webp")
  })

  test("strips query strings and hashes", () => {
    expect(storagePathFromPublicUrl(`${BASE}products/a.jpg?t=123`)).toBe("products/a.jpg")
    expect(storagePathFromPublicUrl(`${BASE}products/a.jpg#top`)).toBe("products/a.jpg")
  })

  test("returns null for external image URLs", () => {
    expect(storagePathFromPublicUrl("https://cdn.example.com/img.jpg")).toBeNull()
    expect(storagePathFromPublicUrl("")).toBeNull()
  })

  test("returns null for other buckets and bare bucket roots", () => {
    expect(
      storagePathFromPublicUrl("https://abc.supabase.co/storage/v1/object/public/avatars/a.jpg"),
    ).toBeNull()
    expect(storagePathFromPublicUrl(BASE)).toBeNull()
  })
})

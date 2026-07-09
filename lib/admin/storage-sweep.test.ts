import { describe, expect, test } from "bun:test"
import { findOrphanImages, type StoredImage, totalBytes } from "./storage-sweep"

function img(path: string, bytes = 1000): StoredImage {
  return { path, createdAt: "2026-07-09T12:00:00Z", bytes }
}

describe("findOrphanImages", () => {
  test("flags every object nothing references", () => {
    const objects = [img("products/a.jpg"), img("products/b.jpg")]
    const referenced = new Set(["products/a.jpg"])
    expect(findOrphanImages(objects, referenced).map((o) => o.path)).toEqual(["products/b.jpg"])
  })

  test("age is irrelevant — even a just-uploaded orphan is swept (user decision 2026-07-09)", () => {
    const objects: StoredImage[] = [
      { path: "products/fresh.jpg", createdAt: new Date().toISOString(), bytes: 1 },
      { path: "products/no-ts.jpg", createdAt: null, bytes: 1 },
    ]
    expect(findOrphanImages(objects, new Set()).map((o) => o.path)).toEqual([
      "products/fresh.jpg",
      "products/no-ts.jpg",
    ])
  })

  test("returns an empty list when everything is referenced", () => {
    const objects = [img("categories/c.webp")]
    expect(findOrphanImages(objects, new Set(["categories/c.webp"]))).toEqual([])
  })
})

describe("totalBytes", () => {
  test("sums object sizes", () => {
    expect(totalBytes([img("a", 300), img("b", 700)])).toBe(1000)
    expect(totalBytes([])).toBe(0)
  })
})

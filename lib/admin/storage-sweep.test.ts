import { describe, expect, test } from "bun:test"
import { findOrphanImages, SWEEP_GRACE_MS, type StoredImage, totalBytes } from "./storage-sweep"

const NOW = Date.parse("2026-07-09T12:00:00Z")

function img(path: string, ageMs: number, bytes = 1000): StoredImage {
  return { path, createdAt: new Date(NOW - ageMs).toISOString(), bytes }
}

const OLD = SWEEP_GRACE_MS + 60_000
const FRESH = SWEEP_GRACE_MS - 60_000

describe("findOrphanImages", () => {
  test("flags old objects nothing references", () => {
    const objects = [img("products/a.jpg", OLD), img("products/b.jpg", OLD)]
    const referenced = new Set(["products/a.jpg"])
    expect(findOrphanImages(objects, referenced, NOW).map((o) => o.path)).toEqual([
      "products/b.jpg",
    ])
  })

  test("keeps unreferenced objects inside the 24h grace window", () => {
    const objects = [img("products/fresh.jpg", FRESH)]
    expect(findOrphanImages(objects, new Set(), NOW)).toEqual([])
  })

  test("sweeps exactly at the grace boundary", () => {
    const objects = [img("products/edge.jpg", SWEEP_GRACE_MS)]
    expect(findOrphanImages(objects, new Set(), NOW)).toHaveLength(1)
  })

  test("keeps objects with missing or unparseable timestamps", () => {
    const objects: StoredImage[] = [
      { path: "products/no-ts.jpg", createdAt: null, bytes: 1 },
      { path: "products/bad-ts.jpg", createdAt: "not-a-date", bytes: 1 },
    ]
    expect(findOrphanImages(objects, new Set(), NOW)).toEqual([])
  })

  test("returns an empty list when everything is referenced", () => {
    const objects = [img("categories/c.webp", OLD)]
    expect(findOrphanImages(objects, new Set(["categories/c.webp"]), NOW)).toEqual([])
  })
})

describe("totalBytes", () => {
  test("sums object sizes", () => {
    expect(totalBytes([img("a", OLD, 300), img("b", OLD, 700)])).toBe(1000)
    expect(totalBytes([])).toBe(0)
  })
})

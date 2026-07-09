/**
 * Pure logic for the admin "Clean up unused images" sweep (the IO lives in
 * lib/db/admin-storage.ts). An object is an orphan when no product/category
 * references it AND it is older than the grace window — a fresh upload may
 * belong to an edit that's still open in a modal, so it must never be swept.
 */

export const SWEEP_GRACE_MS = 24 * 60 * 60 * 1000 // 24 h

/** One bucket object, as returned by the Storage list API. */
export type StoredImage = {
  /** Object path inside the bucket, e.g. `products/<uuid>.jpg`. */
  path: string
  /** ISO timestamp; null when the API omits it. */
  createdAt: string | null
  bytes: number
}

export function findOrphanImages(
  objects: readonly StoredImage[],
  referencedPaths: ReadonlySet<string>,
  nowMs: number,
): StoredImage[] {
  return objects.filter((obj) => {
    if (referencedPaths.has(obj.path)) return false
    const createdMs = obj.createdAt === null ? Number.NaN : Date.parse(obj.createdAt)
    // No parseable age → treat as freshly uploaded and keep it.
    if (!Number.isFinite(createdMs)) return false
    return nowMs - createdMs >= SWEEP_GRACE_MS
  })
}

export function totalBytes(objects: readonly StoredImage[]): number {
  return objects.reduce((sum, obj) => sum + obj.bytes, 0)
}

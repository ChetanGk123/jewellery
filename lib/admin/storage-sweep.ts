/**
 * Pure logic for the admin "Clean up unused images" sweep (the IO lives in
 * lib/db/admin-storage.ts). An object is an orphan when no product/category
 * (or the settings homepage hero) references it — full stop. The original 24h grace window (protecting an
 * upload whose Save hadn't landed yet) was removed at the operator's request
 * (2026-07-09): the sweep is a manual, confirmed action and the dialog now
 * warns to save any in-progress edit first instead.
 */

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
): StoredImage[] {
  return objects.filter((obj) => !referencedPaths.has(obj.path))
}

export function totalBytes(objects: readonly StoredImage[]): number {
  return objects.reduce((sum, obj) => sum + obj.bytes, 0)
}

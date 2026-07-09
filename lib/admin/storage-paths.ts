/** One public bucket for all admin-managed imagery (products, categories). */
export const IMAGE_BUCKET = "product-images"

/** Public-URL prefix Supabase Storage serves the bucket under. */
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${IMAGE_BUCKET}/`

/**
 * Map a public bucket URL back to the object path inside the bucket
 * (`products/<uuid>.jpg`). Returns null for anything that isn't one of our
 * bucket's URLs — external/hotlinked images (e.g. from a bulk import) must
 * never be touched by the storage garbage collector.
 */
export function storagePathFromPublicUrl(url: string): string | null {
  const markerIdx = url.indexOf(PUBLIC_PATH_MARKER)
  if (markerIdx === -1) return null

  const path = url
    .slice(markerIdx + PUBLIC_PATH_MARKER.length)
    .split(/[?#]/)[0]
    .trim()
  return path === "" ? null : path
}

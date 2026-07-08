import "server-only"
import { createServerClient } from "./server"

/**
 * Shared admin image upload (extracted from the product action in 6.11 when
 * categories gained photos). Uploads through the admin cookie session —
 * Storage writes on this bucket are is_admin()-gated by 0010 — and returns
 * the public URL the caller stores on its row. Validates type + size
 * server-side; callers add their own requireAdmin() gate first.
 */

export type UploadResult = { ok: boolean; url?: string; error?: string }

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

/** One public bucket for all admin-managed imagery (products, categories). */
const IMAGE_BUCKET = "product-images"

export async function uploadAdminImage(
  formData: FormData,
  pathPrefix: "products" | "categories",
): Promise<UploadResult> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected." }
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Please choose an image file." }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image must be under 5 MB." }
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
  const path = `${pathPrefix}/${crypto.randomUUID()}.${ext || "jpg"}`

  const supabase = await createServerClient()
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) {
    return { ok: false, error: "Upload failed. Please try again." }
  }

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}

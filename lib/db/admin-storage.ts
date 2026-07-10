import "server-only"
import { IMAGE_BUCKET, storagePathFromPublicUrl } from "@/lib/admin/storage-paths"
import { findOrphanImages, type StoredImage, totalBytes } from "@/lib/admin/storage-sweep"
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

export async function uploadAdminImage(
  formData: FormData,
  pathPrefix: "products" | "categories" | "branding",
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

type AdminClient = Awaited<ReturnType<typeof createServerClient>>

/**
 * A removed image may still be in use elsewhere — another product's gallery or
 * primary image (bulk imports can share URLs), a category photo, or the
 * settings-managed homepage hero (9.4). When any check errors we report
 * "referenced" so the GC keeps the file: a leaked object is recoverable, a
 * deleted one is not.
 */
async function isImageReferenced(supabase: AdminClient, url: string): Promise<boolean> {
  const checks = await Promise.all([
    supabase.from("product").select("id").eq("primary_image_url", url).limit(1),
    supabase
      .from("product")
      .select("id")
      .contains("gallery", JSON.stringify([{ url }]))
      .limit(1),
    supabase.from("category").select("id").eq("image_url", url).limit(1),
    supabase.from("setting").select("id").eq("homepage_hero->>image_url", url).limit(1),
  ])
  if (checks.some((r) => r.error)) return true
  return checks.some((r) => (r.data?.length ?? 0) > 0)
}

/**
 * Best-effort storage GC: after a save/delete drops image URLs from a row,
 * remove the backing objects from the bucket — but only URLs that live in our
 * bucket and are no longer referenced by any product or category. Runs after
 * the DB write, so the caller's own kept images count as references. Never
 * throws: the row is already saved, so a failed cleanup must not fail the
 * action (the object just stays orphaned, same as before this GC existed).
 */
export async function removeUnreferencedAdminImages(urls: string[]): Promise<void> {
  try {
    const candidates = [...new Set(urls)]
      .map((url) => ({ url, path: storagePathFromPublicUrl(url) }))
      .filter((c): c is { url: string; path: string } => c.path !== null)
    if (candidates.length === 0) return

    const supabase = await createServerClient()
    const referenced = await Promise.all(candidates.map((c) => isImageReferenced(supabase, c.url)))
    const orphanPaths = candidates.filter((_, i) => !referenced[i]).map((c) => c.path)
    if (orphanPaths.length === 0) return

    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(orphanPaths)
    if (error) {
      console.error("admin-storage: failed to remove orphaned images", orphanPaths, error)
    }
  } catch (error: unknown) {
    console.error("admin-storage: orphaned-image cleanup failed", error)
  }
}

/* ------------------------- Full-bucket sweep (6.16) ------------------------ */

export type SweepResult =
  { ok: true; scanned: number; removed: number; freedBytes: number } | { ok: false; error: string }

/** The prefixes uploadAdminImage writes under. */
const IMAGE_FOLDERS = ["products", "categories", "branding"] as const
const LIST_PAGE_SIZE = 1000
const DB_PAGE_SIZE = 1000
const REMOVE_CHUNK_SIZE = 100

/**
 * Ground-truth storage GC, run from the Settings page under the clicking
 * admin's session (Storage deletes are is_admin()-gated by 0010 — no service
 * key needed). Lists the whole bucket, collects every image URL any product,
 * category or the homepage hero holds, and removes the rest — the historical
 * orphans, cancelled modal uploads, and bulk-import replacements the
 * write-time GC can't see. Deletes EVERY unreferenced object immediately — no
 * grace window (operator decision 2026-07-09; see lib/admin/storage-sweep.ts).
 */
export async function sweepUnusedAdminImages(): Promise<SweepResult> {
  try {
    const supabase = await createServerClient()

    const [folderLists, referencedPaths] = await Promise.all([
      Promise.all(IMAGE_FOLDERS.map((folder) => listFolderImages(supabase, folder))),
      collectReferencedPaths(supabase),
    ])
    const objects = folderLists.flat()

    const orphans = findOrphanImages(objects, referencedPaths)
    for (let i = 0; i < orphans.length; i += REMOVE_CHUNK_SIZE) {
      const chunk = orphans.slice(i, i + REMOVE_CHUNK_SIZE)
      const { error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .remove(chunk.map((obj) => obj.path))
      if (error) throw new Error(`remove failed: ${error.message}`)
    }

    return {
      ok: true,
      scanned: objects.length,
      removed: orphans.length,
      freedBytes: totalBytes(orphans),
    }
  } catch (error: unknown) {
    console.error("admin-storage: image sweep failed", error)
    return { ok: false, error: "Couldn't complete the cleanup. Please try again." }
  }
}

/** Page through one bucket folder; entries without an id are subfolders. */
async function listFolderImages(
  supabase: AdminClient,
  folder: (typeof IMAGE_FOLDERS)[number],
): Promise<StoredImage[]> {
  const objects: StoredImage[] = []
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .list(folder, { limit: LIST_PAGE_SIZE, offset })
    if (error) throw new Error(`list ${folder} failed: ${error.message}`)

    const files = (data ?? []).filter((entry) => entry.id !== null)
    objects.push(
      ...files.map((entry) => ({
        path: `${folder}/${entry.name}`,
        createdAt: entry.created_at ?? null,
        bytes: typeof entry.metadata?.size === "number" ? entry.metadata.size : 0,
      })),
    )
    if ((data?.length ?? 0) < LIST_PAGE_SIZE) return objects
  }
}

/**
 * Every bucket path referenced by any product (gallery + primary), category,
 * or the settings-managed homepage hero (9.4 — without the setting read the
 * first sweep after a hero upload would delete it).
 */
async function collectReferencedPaths(supabase: AdminClient): Promise<Set<string>> {
  const referenced = new Set<string>()
  const add = (url: unknown) => {
    if (typeof url !== "string" || url === "") return
    const path = storagePathFromPublicUrl(url)
    if (path) referenced.add(path)
  }

  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("product")
      .select("primary_image_url, gallery")
      .range(from, from + DB_PAGE_SIZE - 1)
    if (error) throw new Error(`read products failed: ${error.message}`)

    for (const row of data ?? []) {
      add(row.primary_image_url)
      if (Array.isArray(row.gallery)) {
        for (const im of row.gallery) add((im as { url?: unknown } | null)?.url)
      }
    }
    if ((data?.length ?? 0) < DB_PAGE_SIZE) break
  }

  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("category")
      .select("image_url")
      .range(from, from + DB_PAGE_SIZE - 1)
    if (error) throw new Error(`read categories failed: ${error.message}`)

    for (const row of data ?? []) add(row.image_url)
    if ((data?.length ?? 0) < DB_PAGE_SIZE) break
  }

  // Singleton row; erroring aborts the sweep (conservative — nothing deleted).
  const { data: setting, error } = await supabase
    .from("setting")
    .select("homepage_hero")
    .maybeSingle()
  if (error) throw new Error(`read settings failed: ${error.message}`)
  add((setting?.homepage_hero as { image_url?: unknown } | null)?.image_url)

  return referenced
}

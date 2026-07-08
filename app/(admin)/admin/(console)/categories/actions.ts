"use server"

import { revalidatePath, updateTag } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"
import { CACHE_TAGS } from "@/lib/db/cache"
import { uploadAdminImage } from "@/lib/db/admin-storage"
import { createServerClient } from "@/lib/db/server"
import { ROUTES } from "@/lib/routes"

/** The category modal's payload — `id: null` means create. */
export type CategoryInput = {
  id: string | null
  name: string
  description: string
  /** Storefront tile photo (6.11); null/blank clears back to the gradient. */
  imageUrl: string | null
}

export type CategoryActionResult = { ok: boolean; error?: string }

function messageFor(code: string | undefined, raw: string): string {
  if (code === "23505") return "A category with that name already exists."
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that."
  if (raw.includes("CATEGORY_NOT_FOUND")) return "That category no longer exists."
  if (raw.includes("NAME_REQUIRED")) return "Category name is required."
  if (raw.includes("INVALID_IMAGE_URL")) return "The image URL looks invalid. Re-upload the photo."
  return "Couldn't save the category. Please try again."
}

/**
 * Upload one category photo (6.11) — same is_admin()-gated Storage pipeline
 * as product images, stored under categories/.
 */
export async function uploadCategoryImage(formData: FormData) {
  await requireAdmin(ROUTES.adminCategories)
  return uploadAdminImage(formData, "categories")
}

/**
 * Create or update a category through the admin-only `admin_upsert_category`
 * RPC (0011). The RPC re-checks admin + required name and generates the slug on
 * insert.
 */
export async function upsertCategory(input: CategoryInput): Promise<CategoryActionResult> {
  await requireAdmin(ROUTES.adminCategories)

  const name = input.name?.trim() ?? ""
  if (!name) return { ok: false, error: "Category name is required." }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_upsert_category", {
    p_id: input.id,
    p_payload: {
      name,
      description: input.description?.trim() ?? "",
      image_url: input.imageUrl?.trim() ?? "",
    },
  })

  if (error) {
    return { ok: false, error: messageFor(error.code, error.message) }
  }

  revalidatePath(ROUTES.adminCategories)
  // Category names are embedded in cached product listing rows too.
  updateTag(CACHE_TAGS.categories)
  updateTag(CACHE_TAGS.products)
  return { ok: true }
}

/**
 * Delete a category through the admin-only `admin_delete_category` RPC (0011).
 * The RPC refuses when the category still holds products — surfaced here as a
 * friendly "re-home first" message rather than a raw FK error.
 */
export async function deleteCategory(id: string): Promise<CategoryActionResult> {
  await requireAdmin(ROUTES.adminCategories)

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("admin_delete_category", { p_id: id })

  if (error) {
    if (error.message.includes("CATEGORY_HAS_PRODUCTS")) {
      return {
        ok: false,
        error: "This collection still has products. Move or remove them before deleting it.",
      }
    }
    return { ok: false, error: messageFor(error.code, error.message) }
  }

  revalidatePath(ROUTES.adminCategories)
  updateTag(CACHE_TAGS.categories)
  updateTag(CACHE_TAGS.products)
  return { ok: true }
}

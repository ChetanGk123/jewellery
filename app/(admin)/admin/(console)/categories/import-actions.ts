"use server"

import { revalidatePath, updateTag } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"
import { CATEGORY_COLUMNS, planCategoriesImport } from "@/lib/admin/bulk/categories"
import { parseBulkRowErrors } from "@/lib/admin/bulk/errors"
import type { ApplyResult, ImportPlan, ParseImportResult } from "@/lib/admin/bulk/types"
import { readRows } from "@/lib/admin/bulk/xlsx"
import { CACHE_TAGS } from "@/lib/db/cache"
import { getAllCategoriesForExport } from "@/lib/db/admin-categories"
import { createServerClient } from "@/lib/db/server"
import type { Json } from "@/lib/db/types"
import { ROUTES } from "@/lib/routes"

/** Friendly copy for row-level RPC failures (mirrors upsertCategory's map). */
function rowMessageFor(code: string, raw: string): string {
  if (code === "23505") return "A category with that name already exists."
  if (raw.includes("CATEGORY_NOT_FOUND")) return "That category no longer exists."
  if (raw.includes("NAME_REQUIRED")) return "Category name is required."
  if (raw.includes("INVALID_IMAGE_URL")) return "The image URL looks invalid."
  return "Couldn't save this row."
}

/** Read + validate the uploaded sheet against current data. Never writes. */
async function planFromFile(formData: FormData): Promise<{ plan: ImportPlan } | { error: string }> {
  const file = formData.get("file")
  if (!(file instanceof File)) return { error: "Choose an .xlsx file to import." }

  const read = await readRows(
    file,
    CATEGORY_COLUMNS.map((c) => c.header),
  )
  if (!read.ok) return { error: read.error }

  const existing = await getAllCategoriesForExport()
  return { plan: planCategoriesImport(read.rows, { existing }) }
}

/** Step 1 — dry-run the sheet and return the preview for the confirm dialog. */
export async function parseCategoriesImport(formData: FormData): Promise<ParseImportResult> {
  await requireAdmin(ROUTES.adminCategories)
  const result = await planFromFile(formData)
  if ("error" in result) return { ok: false, error: result.error }
  return { ok: true, preview: result.plan.preview }
}

/** Step 2 — re-parse the same file and apply via `admin_bulk_upsert_categories`. */
export async function applyCategoriesImport(formData: FormData): Promise<ApplyResult> {
  await requireAdmin(ROUTES.adminCategories)

  const result = await planFromFile(formData)
  if ("error" in result) return { ok: false, error: result.error }
  const { plan } = result

  if (plan.preview.errors.length > 0) {
    return {
      ok: false,
      error: "The sheet has rows with problems — fix them and re-upload.",
      rowErrors: plan.preview.errors,
    }
  }
  if (plan.rows.length === 0) {
    return { ok: false, error: "Nothing to import — every row matches the current data." }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc("admin_bulk_upsert_categories", {
    p_rows: plan.rows.map((r) => ({
      row_num: r.rowNum,
      id: r.id ?? "",
      payload: r.payload,
    })) as unknown as Json,
  })

  if (error) {
    const rowErrors = parseBulkRowErrors(error.message, rowMessageFor)
    if (rowErrors) {
      return { ok: false, error: "Import rolled back — no categories were changed.", rowErrors }
    }
    return { ok: false, error: "Couldn't import the sheet. Please try again." }
  }

  revalidatePath(ROUTES.adminCategories)
  // Category names are embedded in cached product listing rows too.
  updateTag(CACHE_TAGS.categories)
  updateTag(CACHE_TAGS.products)
  const summary = (data ?? {}) as { created?: number; updated?: number }
  return { ok: true, created: summary.created ?? 0, updated: summary.updated ?? 0 }
}

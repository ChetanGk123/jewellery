"use server"

import { revalidatePath, updateTag } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"
import { parseBulkRowErrors } from "@/lib/admin/bulk/errors"
import { PRODUCT_COLUMNS, planProductsImport } from "@/lib/admin/bulk/products"
import type { ApplyResult, ImportPlan, ParseImportResult } from "@/lib/admin/bulk/types"
import { readRows } from "@/lib/admin/bulk/xlsx"
import { CACHE_TAGS } from "@/lib/db/cache"
import { getAdminCategories, getAllProductsForExport } from "@/lib/db/admin-products"
import { createServerClient } from "@/lib/db/server"
import type { Json } from "@/lib/db/types"
import { ROUTES } from "@/lib/routes"

/** Friendly copy for row-level RPC failures (mirrors upsertProduct's map). */
function rowMessageFor(code: string, raw: string): string {
  if (code === "23505") return "A product with that SKU already exists."
  if (raw.includes("PRODUCT_NOT_FOUND")) return "That product no longer exists."
  if (raw.includes("NAME_REQUIRED")) return "Product name is required."
  if (raw.includes("SKU_REQUIRED")) return "SKU is required."
  if (raw.includes("CATEGORY_REQUIRED")) return "Pick a valid category."
  return "Couldn't save this row."
}

/** Read + validate the uploaded sheet against current data. Never writes. */
async function planFromFile(formData: FormData): Promise<{ plan: ImportPlan } | { error: string }> {
  const file = formData.get("file")
  if (!(file instanceof File)) return { error: "Choose an .xlsx file to import." }

  const read = await readRows(
    file,
    PRODUCT_COLUMNS.map((c) => c.header),
  )
  if (!read.ok) return { error: read.error }

  const [existing, categories] = await Promise.all([
    getAllProductsForExport(),
    getAdminCategories(),
  ])
  return { plan: planProductsImport(read.rows, { categories, existing }) }
}

/** Step 1 — dry-run the sheet and return the preview for the confirm dialog. */
export async function parseProductsImport(formData: FormData): Promise<ParseImportResult> {
  await requireAdmin(ROUTES.adminProducts)
  const result = await planFromFile(formData)
  if ("error" in result) return { ok: false, error: result.error }
  return { ok: true, preview: result.plan.preview }
}

/**
 * Step 2 — re-parse the same file (the client never sends parsed rows, so a
 * tampered payload can't sneak past validation) and apply it through the
 * all-or-nothing `admin_bulk_upsert_products` RPC (0037).
 */
export async function applyProductsImport(formData: FormData): Promise<ApplyResult> {
  await requireAdmin(ROUTES.adminProducts)

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
  const { data, error } = await supabase.rpc("admin_bulk_upsert_products", {
    p_rows: plan.rows.map((r) => ({
      row_num: r.rowNum,
      id: r.id ?? "",
      payload: r.payload,
    })) as unknown as Json,
  })

  if (error) {
    const rowErrors = parseBulkRowErrors(error.message, rowMessageFor)
    if (rowErrors) {
      return { ok: false, error: "Import rolled back — no products were changed.", rowErrors }
    }
    return { ok: false, error: "Couldn't import the sheet. Please try again." }
  }

  revalidatePath(ROUTES.adminProducts)
  updateTag(CACHE_TAGS.products)
  const summary = (data ?? {}) as { created?: number; updated?: number }
  return { ok: true, created: summary.created ?? 0, updated: summary.updated ?? 0 }
}

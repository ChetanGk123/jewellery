"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin/auth"
import { COUPON_COLUMNS, planCouponsImport } from "@/lib/admin/bulk/coupons"
import { parseBulkRowErrors } from "@/lib/admin/bulk/errors"
import type { ApplyResult, ImportPlan, ParseImportResult } from "@/lib/admin/bulk/types"
import { readRows } from "@/lib/admin/bulk/xlsx"
import { getAllCouponsForExport } from "@/lib/db/admin-coupons"
import { createServerClient } from "@/lib/db/server"
import type { Json } from "@/lib/db/types"
import { ROUTES } from "@/lib/routes"

/** Friendly copy for row-level RPC failures (mirrors upsertCoupon's map). */
function rowMessageFor(code: string, raw: string): string {
  if (code === "23505") return "A coupon with that code already exists."
  if (raw.includes("COUPON_NOT_FOUND")) return "That coupon no longer exists."
  if (raw.includes("CODE_REQUIRED")) return "Coupon code is required."
  if (raw.includes("INVALID_KIND")) return "Pick a valid discount type."
  return "Couldn't save this row."
}

/** Read + validate the uploaded sheet against current data. Never writes. */
async function planFromFile(formData: FormData): Promise<{ plan: ImportPlan } | { error: string }> {
  const file = formData.get("file")
  if (!(file instanceof File)) return { error: "Choose an .xlsx file to import." }

  const read = await readRows(
    file,
    COUPON_COLUMNS.map((c) => c.header),
  )
  if (!read.ok) return { error: read.error }

  const existing = await getAllCouponsForExport()
  return { plan: planCouponsImport(read.rows, { existing }) }
}

/** Step 1 — dry-run the sheet and return the preview for the confirm dialog. */
export async function parseCouponsImport(formData: FormData): Promise<ParseImportResult> {
  await requireAdmin(ROUTES.adminCoupons)
  const result = await planFromFile(formData)
  if ("error" in result) return { ok: false, error: result.error }
  return { ok: true, preview: result.plan.preview }
}

/** Step 2 — re-parse the same file and apply via `admin_bulk_upsert_coupons`. */
export async function applyCouponsImport(formData: FormData): Promise<ApplyResult> {
  await requireAdmin(ROUTES.adminCoupons)

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
  const { data, error } = await supabase.rpc("admin_bulk_upsert_coupons", {
    p_rows: plan.rows.map((r) => ({
      row_num: r.rowNum,
      id: r.id ?? "",
      payload: r.payload,
    })) as unknown as Json,
  })

  if (error) {
    const rowErrors = parseBulkRowErrors(error.message, rowMessageFor)
    if (rowErrors) {
      return { ok: false, error: "Import rolled back — no coupons were changed.", rowErrors }
    }
    return { ok: false, error: "Couldn't import the sheet. Please try again." }
  }

  revalidatePath(ROUTES.adminCoupons)
  const summary = (data ?? {}) as { created?: number; updated?: number }
  return { ok: true, created: summary.created ?? 0, updated: summary.updated ?? 0 }
}

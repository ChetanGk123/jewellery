import { requireAdmin } from "@/lib/admin/auth"
import {
  CATEGORIES_SHEET,
  CATEGORY_COLUMNS,
  serializeCategoryRow,
} from "@/lib/admin/bulk/categories"
import { XLSX_MIME } from "@/lib/admin/bulk/types"
import { buildWorkbook } from "@/lib/admin/bulk/xlsx"
import { getAllCategoriesForExport } from "@/lib/db/admin-categories"
import { ROUTES } from "@/lib/routes"

/** Download all collections as categories-YYYY-MM-DD.xlsx for bulk editing. */
export async function GET(): Promise<Response> {
  await requireAdmin(ROUTES.adminCategories)

  const rows = await getAllCategoriesForExport()
  const bytes = await buildWorkbook({
    sheetName: CATEGORIES_SHEET,
    columns: CATEGORY_COLUMNS,
    rows: rows.map(serializeCategoryRow),
  })

  const date = new Date().toISOString().slice(0, 10)
  return new Response(bytes, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="categories-${date}.xlsx"`,
    },
  })
}

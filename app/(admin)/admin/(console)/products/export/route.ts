import { requireAdmin } from "@/lib/admin/auth"
import { PRODUCT_COLUMNS, PRODUCTS_SHEET, serializeProductRow } from "@/lib/admin/bulk/products"
import { XLSX_MIME } from "@/lib/admin/bulk/types"
import { buildWorkbook } from "@/lib/admin/bulk/xlsx"
import { PRODUCT_STATUS_OPTIONS } from "@/lib/admin/product-status"
import { getAdminCategories, getAllProductsForExport } from "@/lib/db/admin-products"
import { ROUTES } from "@/lib/routes"

/**
 * Download the full catalogue as products-YYYY-MM-DD.xlsx for bulk editing.
 * proxy.ts coarse-gates /admin/*; `requireAdmin` here is the real check
 * (signed-out hits get its redirect, which the browser follows to sign-in).
 */
export async function GET(): Promise<Response> {
  await requireAdmin(ROUTES.adminProducts)

  const [rows, categories] = await Promise.all([getAllProductsForExport(), getAdminCategories()])
  const bytes = await buildWorkbook({
    sheetName: PRODUCTS_SHEET,
    columns: PRODUCT_COLUMNS,
    rows: rows.map(serializeProductRow),
    dropdowns: {
      categories: categories.map((c) => c.name),
      status: [...PRODUCT_STATUS_OPTIONS],
      bool: ["TRUE", "FALSE"],
    },
  })

  const date = new Date().toISOString().slice(0, 10)
  return new Response(bytes, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="products-${date}.xlsx"`,
    },
  })
}

import { requireAdmin } from "@/lib/admin/auth"
import {
  COUPON_COLUMNS,
  COUPON_KINDS,
  COUPONS_SHEET,
  serializeCouponRow,
} from "@/lib/admin/bulk/coupons"
import { XLSX_MIME } from "@/lib/admin/bulk/types"
import { buildWorkbook } from "@/lib/admin/bulk/xlsx"
import { getAllCouponsForExport } from "@/lib/db/admin-coupons"
import { ROUTES } from "@/lib/routes"

/** Download all coupons as coupons-YYYY-MM-DD.xlsx for bulk editing. */
export async function GET(): Promise<Response> {
  await requireAdmin(ROUTES.adminCoupons)

  const rows = await getAllCouponsForExport()
  const bytes = await buildWorkbook({
    sheetName: COUPONS_SHEET,
    columns: COUPON_COLUMNS,
    rows: rows.map(serializeCouponRow),
    dropdowns: {
      kinds: [...COUPON_KINDS],
      bool: ["TRUE", "FALSE"],
    },
  })

  const date = new Date().toISOString().slice(0, 10)
  return new Response(bytes, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="coupons-${date}.xlsx"`,
    },
  })
}

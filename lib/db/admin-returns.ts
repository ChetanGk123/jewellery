import "server-only"
import type { ReturnFilter, ReturnStatus } from "@/lib/returns"
import { type AdminRead, loadAdmin } from "./admin-read"
import { createServerClient } from "./server"

/**
 * Admin reads for the Returns queue (TASKS 8.7d). Rows come through the
 * admin's cookie session ("admin reads return requests" RLS, 0043) with the
 * order's identity embedded; evidence photos live in the PRIVATE
 * `return-photos` bucket, so each listed row's paths are resolved to
 * short-lived signed URLs here (the bucket's read policy admits admins).
 * Writes go through the `admin_set_return_status` RPC only.
 */

export type AdminReturnRow = {
  id: string
  status: ReturnStatus | string
  resolution: string
  reason: string
  upiId: string | null
  /** Signed, time-limited URLs for the evidence photos (private bucket). */
  photoUrls: string[]
  refundAmountPaise: number | null
  refundReference: string | null
  adminNote: string | null
  createdAt: string
  resolvedAt: string | null
  orderNo: string
  orderTotalPaise: number
  customerName: string
  customerPhone: string
}

export type ReturnCounts = Record<ReturnFilter, number>

export type AdminReturnsData = {
  rows: AdminReturnRow[]
  counts: ReturnCounts
  filter: ReturnFilter
}

const OPEN_STATUSES = ["Requested", "Approved", "Received"]
const CLOSED_STATUSES = ["Refunded", "Exchanged", "Rejected"]

/** Far above plausible volume; the queue isn't paginated (unlike orders). */
const RETURNS_CAP = 200

const SIGNED_URL_SECONDS = 3600

function emptyData(filter: ReturnFilter): AdminReturnsData {
  return { rows: [], counts: { Open: 0, Closed: 0, All: 0 }, filter }
}

export async function listReturnRequests(filter: ReturnFilter): Promise<AdminRead<AdminReturnsData>> {
  return loadAdmin(
    "returns",
    async () => {
      const supabase = await createServerClient()

      let rowsQuery = supabase
        .from("return_request")
        .select(
          "id, status, resolution, reason, upi_id, photos, refund_amount_paise, refund_reference, admin_note, created_at, resolved_at, order!inner(order_no, total_paise, customer_name, customer_phone)",
        )
        .order("created_at", { ascending: false })
        .limit(RETURNS_CAP)
      if (filter === "Open") rowsQuery = rowsQuery.in("status", OPEN_STATUSES)
      if (filter === "Closed") rowsQuery = rowsQuery.in("status", CLOSED_STATUSES)

      const headCount = (statuses: string[]) =>
        supabase
          .from("return_request")
          .select("*", { count: "exact", head: true })
          .in("status", statuses)

      const [rowsRes, openRes, closedRes] = await Promise.all([
        rowsQuery,
        headCount(OPEN_STATUSES),
        headCount(CLOSED_STATUSES),
      ])
      if (rowsRes.error) throw new Error(`returns read failed: ${rowsRes.error.message}`)

      const requests = rowsRes.data ?? []

      // One batch signing call for every photo on the page.
      const allPaths = requests.flatMap((r) => r.photos)
      const urlByPath = new Map<string, string>()
      if (allPaths.length > 0) {
        const { data: signed, error } = await supabase.storage
          .from("return-photos")
          .createSignedUrls(allPaths, SIGNED_URL_SECONDS)
        if (error) {
          // Photos degrade to "unavailable" rather than failing the queue.
          console.error("[admin-read] return photo signing failed:", error.message)
        }
        for (const entry of signed ?? []) {
          if (entry.signedUrl && entry.path) urlByPath.set(entry.path, entry.signedUrl)
        }
      }

      const rows: AdminReturnRow[] = requests.map((r) => ({
        id: r.id,
        status: r.status,
        resolution: r.resolution,
        reason: r.reason,
        upiId: r.upi_id,
        photoUrls: r.photos
          .map((path) => urlByPath.get(path))
          .filter((url): url is string => Boolean(url)),
        refundAmountPaise: r.refund_amount_paise,
        refundReference: r.refund_reference,
        adminNote: r.admin_note,
        createdAt: r.created_at,
        resolvedAt: r.resolved_at,
        orderNo: r.order.order_no,
        orderTotalPaise: r.order.total_paise,
        customerName: r.order.customer_name,
        customerPhone: r.order.customer_phone,
      }))

      const open = openRes.count ?? 0
      const closed = closedRes.count ?? 0
      const counts: ReturnCounts = { Open: open, Closed: closed, All: open + closed }

      return { rows, counts, filter }
    },
    emptyData(filter),
  )
}

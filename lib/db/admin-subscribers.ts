import "server-only"
import {
  ADMIN_SUBSCRIBERS_PAGE_SIZE,
  type AdminSubscriberRow,
  type SubscriberKpi,
  type SubscriberSource,
} from "@/lib/admin/subscriber"
import { type AdminRead, loadAdmin } from "./admin-read"
import { createServerClient } from "./server"

export type AdminSubscribersPage = {
  rows: AdminSubscriberRow[]
  kpis: SubscriberKpi[]
  search: string
  page: number
  pageCount: number
  total: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** The known signup sources — used for the "Top source" KPI head-counts. */
const SOURCES: SubscriberSource[] = ["footer", "checkout", "popup"]

/** Hard ceiling on a Copy/Export fetch so the bulk read is never truly unbounded. */
const EXPORT_CAP = 5000

const EMPTY_KPIS: SubscriberKpi[] = [
  { label: "Total subscribers", value: "0", accent: "#71182B" },
  { label: "Joined this week", value: "0", accent: "#15692F" },
  { label: "Top source", value: "—", accent: "#B7791F" },
]

function emptyPage(search: string, page: number): AdminSubscribersPage {
  return { rows: [], kpis: EMPTY_KPIS, search, page, pageCount: 1, total: 0 }
}

function mapRow(s: {
  id: string
  email: string
  source: string
  created_at: string
}): AdminSubscriberRow {
  return {
    id: s.id,
    email: s.email,
    source: s.source as SubscriberSource,
    createdAt: s.created_at,
  }
}

/** ilike-safe email fragment: strip `%`/`,` so the search can't inject wildcards. */
function sanitizeEmailSearch(raw: string): string {
  return raw.replace(/[%,]/g, " ").trim()
}

/**
 * Admin mailing list (TASKS 3.9, paginated in 5.10). Reads one page of
 * `subscriber` rows through the admin's cookie session (0017
 * `subscriber_admin_read` RLS policy), newest first, optionally filtered by an
 * email search. The three KPI cards are computed from **aggregate** reads
 * (exact counts + per-source head-counts) independent of the page, so they stay
 * true for the whole list as it grows monotonically. Copy/Export use
 * `getAllSubscribers` (below). Writes go through the `subscribe_email` /
 * `admin_remove_subscriber` RPCs (0017).
 */
export async function listAdminSubscribers(opts: {
  search: string
  page: number
}): Promise<AdminRead<AdminSubscribersPage>> {
  const search = sanitizeEmailSearch(opts.search)
  const page = Math.max(1, opts.page)

  return loadAdmin(
    "subscribers",
    async () => {
      const supabase = await createServerClient()
      const from = (page - 1) * ADMIN_SUBSCRIBERS_PAGE_SIZE
      const weekAgoIso = new Date(Date.now() - WEEK_MS).toISOString()

      let rowsQuery = supabase
        .from("subscriber")
        .select("id, email, source, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + ADMIN_SUBSCRIBERS_PAGE_SIZE - 1)
      if (search) rowsQuery = rowsQuery.ilike("email", `%${search}%`)

      const totalCount = supabase.from("subscriber").select("*", { count: "exact", head: true })
      const weekCount = supabase
        .from("subscriber")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekAgoIso)
      const sourceCounts = SOURCES.map((src) =>
        supabase.from("subscriber").select("*", { count: "exact", head: true }).eq("source", src),
      )

      const [rowsRes, totalRes, weekRes, ...srcRes] = await Promise.all([
        rowsQuery,
        totalCount,
        weekCount,
        ...sourceCounts,
      ])

      const rows = (rowsRes.data ?? []).map(mapRow)
      const total = rowsRes.count ?? 0 // total of the *filtered* set, for the pager
      const pageCount = Math.max(1, Math.ceil(total / ADMIN_SUBSCRIBERS_PAGE_SIZE))

      const kpis = buildKpis(
        totalRes.count ?? 0,
        weekRes.count ?? 0,
        SOURCES.map((src, i) => ({ source: src, count: srcRes[i].count ?? 0 })),
      )

      return { rows, kpis, search, page, pageCount, total }
    },
    emptyPage(search, page),
  )
}

/**
 * Every subscriber (capped) for the Copy emails / Export CSV bulk actions — a
 * deliberate one-shot read behind an explicit click, distinct from the paginated
 * page render. Capped at {@link EXPORT_CAP} so it can't run away.
 */
export async function getAllSubscribers(): Promise<AdminSubscriberRow[]> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from("subscriber")
      .select("id, email, source, created_at")
      .order("created_at", { ascending: false })
      .limit(EXPORT_CAP)
    return (data ?? []).map(mapRow)
  } catch (err) {
    console.error("[admin-read] subscribers-export failed:", err)
    return []
  }
}

/** Total, joined-this-week, and the leading source with its count. */
function buildKpis(
  total: number,
  thisWeek: number,
  bySource: { source: SubscriberSource; count: number }[],
): SubscriberKpi[] {
  const top = [...bySource].filter((s) => s.count > 0).sort((a, b) => b.count - a.count)[0]
  const topLabel = top ? `${labelForSource(top.source)} · ${top.count}` : "—"

  return [
    { label: "Total subscribers", value: String(total), accent: "#71182B" },
    { label: "Joined this week", value: String(thisWeek), accent: "#15692F" },
    { label: "Top source", value: topLabel, accent: "#B7791F" },
  ]
}

function labelForSource(source: string): string {
  return source.charAt(0).toUpperCase() + source.slice(1)
}

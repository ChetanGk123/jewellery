import "server-only"
import { istDayStartIso, shiftDate, type OrderDateRange } from "@/lib/admin/order-dates"
import { ORDER_STATUSES, ORDERS_PAGE_SIZE, type OrderStatus } from "@/lib/admin/order-status"
import { type AdminRead, loadAdmin } from "./admin-read"
import { createServerClient } from "./server"

/**
 * Admin order queue (Phase 3.3). Reads `order` + `order_item` through the
 * admin's own cookie session — the `is_admin()` RLS policies (0006) permit it,
 * so no service-role key is needed. Each returned row carries the *full* order
 * (customer, address, money, line items) so the client can open the fulfilment
 * drawer instantly without a second round-trip.
 */

// Re-exported for server-side callers; client components import these from
// @/lib/admin/order-status directly (this module is server-only).
export { ORDER_STATUSES, ORDERS_PAGE_SIZE }

/** Filter key for the queue — a real status or the catch-all "All". */
export type OrderFilter = "All" | OrderStatus

export type AdminOrderItem = {
  name: string
  tone: string | null
  qty: number
  lineTotalPaise: number
}

export type AdminOrderRow = {
  id: string
  orderNo: string
  status: string
  createdAt: string
  dateLabel: string
  customerName: string
  phone: string
  email: string
  addressLine: string
  city: string
  state: string
  pincode: string
  paymentMethod: string
  paymentLabel: string
  subtotalPaise: number
  discountPaise: number
  shippingPaise: number
  totalPaise: number
  itemCount: number
  items: AdminOrderItem[]
  awb: string | null
  /** Courier tracking page for this shipment (6.4c) — shown to the customer. */
  trackingUrl: string | null
  /** Lifetime orders from this customer (matched by phone), incl. this one. */
  customerOrderCount: number
  /** How many of those were cancelled — the COD-risk signal. */
  customerCancelledCount: number
  /** Chronological who/when history: placed → status changes → notes (5.16). */
  events: OrderEvent[]
}

/** One drawer-timeline entry. */
export type OrderEvent = {
  id: string
  kind: "placed" | "status" | "note"
  /** "Order placed", "Pending → Confirmed", or the note text. */
  summary: string
  /** Admin who acted; null for the synthetic "placed" entry. */
  actorEmail: string | null
  /** IST date + time, e.g. "04 Jul 2026, 6:32 pm". */
  atLabel: string
  createdAt: string
}

/** Tab counts: one per status plus the "All" total. */
export type OrderCounts = Record<OrderFilter, number>

export type AdminOrdersPage = {
  rows: AdminOrderRow[]
  counts: OrderCounts
  filter: OrderFilter
  search: string
  /** The resolved date window the rows/counts reflect (6.7). */
  range: OrderDateRange
  page: number
  pageCount: number
  total: number
}

const IST = "Asia/Kolkata"
const PAYMENT_LABELS: Record<string, string> = {
  cod: "COD",
  razorpay: "Razorpay",
}

/** IST date, e.g. "04 Jul 2026". */
function istDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/** IST date + time for timeline entries, e.g. "04 Jul 2026, 6:32 pm". */
function istDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

/** Coerce an untrusted `?status=` value to a valid filter (defaults to All). */
export function toOrderFilter(value: string | undefined): OrderFilter {
  return value && (ORDER_STATUSES as string[]).includes(value) ? (value as OrderFilter) : "All"
}

// One string literal (not concatenated) so supabase-js can infer the embedded
// order_item relation type from the select.
const SELECT =
  "id, order_no, status, created_at, customer_name, customer_phone, customer_email, address_line, city, state, pincode, payment_method, subtotal_paise, discount_paise, shipping_paise, total_paise, awb, tracking_url, order_item(name, tone, qty, line_total_paise)"

const EMPTY_COUNTS: OrderCounts = {
  All: 0,
  Pending: 0,
  Confirmed: 0,
  Packed: 0,
  Shipped: 0,
  Delivered: 0,
  Cancelled: 0,
}

function emptyPage(
  filter: OrderFilter,
  search: string,
  range: OrderDateRange,
  page: number,
): AdminOrdersPage {
  return {
    rows: [],
    counts: EMPTY_COUNTS,
    filter,
    search,
    range,
    page,
    pageCount: 0,
    total: 0,
  }
}

// Columns an operator would recognise an order by when a customer calls: the
// order number, name, phone, or email. `%`/`,`/`()` are stripped first — they'd
// otherwise act as ilike wildcards or break PostgREST's `or()` filter grammar.
// Returns null when nothing searchable survives sanitisation.
function buildOrderSearchOr(raw: string): string | null {
  const q = raw.replace(/[%,()]/g, " ").trim()
  if (!q) return null
  return [
    `order_no.ilike.%${q}%`,
    `customer_name.ilike.%${q}%`,
    `customer_phone.ilike.%${q}%`,
    `customer_email.ilike.%${q}%`,
  ].join(",")
}

/** The `SELECT` row shape (order + embedded order_item lines). */
type OrderSelectRow = {
  id: string
  order_no: string
  status: string
  created_at: string
  customer_name: string
  customer_phone: string
  customer_email: string
  address_line: string
  city: string
  state: string
  pincode: string
  payment_method: string
  subtotal_paise: number
  discount_paise: number
  shipping_paise: number
  total_paise: number
  awb: string | null
  tracking_url: string | null
  order_item: {
    name: string
    tone: string | null
    qty: number
    line_total_paise: number
  }[]
}

/** The audit-log columns the timeline needs (5.16). */
const AUDIT_SELECT = "id, entity_id, action, actor_email, summary, created_at"

/** Timeline actions we surface — status changes (0026) + notes (0028). */
const TIMELINE_ACTIONS = ["order.status", "order.note"]

type AuditSelectRow = {
  id: string
  entity_id: string | null
  action: string
  actor_email: string | null
  summary: string | null
  created_at: string
}

/** Map an audit row (already known to be a timeline action) to an event. */
export function toOrderEvent(row: {
  id: string
  action: string
  actor_email: string | null
  summary: string | null
  created_at: string
}): OrderEvent {
  return {
    id: row.id,
    kind: row.action === "order.note" ? "note" : "status",
    summary: row.summary ?? "",
    actorEmail: row.actor_email,
    atLabel: istDateTime(row.created_at),
    createdAt: row.created_at,
  }
}

/** Group timeline audit rows by order number (`entity_id`). */
function groupEvents(rows: AuditSelectRow[]): Map<string, OrderEvent[]> {
  const byOrder = new Map<string, OrderEvent[]>()
  for (const row of rows) {
    if (!row.entity_id) continue
    const list = byOrder.get(row.entity_id) ?? []
    byOrder.set(row.entity_id, [...list, toOrderEvent(row)])
  }
  return byOrder
}

/** Per-customer order history (keyed by phone — stable across guest edits). */
type CustomerHistory = { orders: number; cancelled: number }

/** Tally `{phone → history}` from narrow `customer_phone, status` rows. */
function tallyHistory(
  rows: { customer_phone: string; status: string }[],
): Map<string, CustomerHistory> {
  const byPhone = new Map<string, CustomerHistory>()
  for (const row of rows) {
    const prev = byPhone.get(row.customer_phone) ?? { orders: 0, cancelled: 0 }
    byPhone.set(row.customer_phone, {
      orders: prev.orders + 1,
      cancelled: prev.cancelled + (row.status === "Cancelled" ? 1 : 0),
    })
  }
  return byPhone
}

/** Map a `SELECT` row to the camelCase `AdminOrderRow` the console uses. */
function mapOrderRow(
  o: OrderSelectRow,
  history?: CustomerHistory,
  auditEvents: OrderEvent[] = [],
): AdminOrderRow {
  const items = o.order_item ?? []
  // Every timeline starts at placement; audit rows arrive oldest-first.
  const placed: OrderEvent = {
    id: `placed-${o.id}`,
    kind: "placed",
    summary: "Order placed",
    actorEmail: null,
    atLabel: istDateTime(o.created_at),
    createdAt: o.created_at,
  }
  return {
    id: o.id,
    orderNo: o.order_no,
    status: o.status,
    createdAt: o.created_at,
    dateLabel: istDate(o.created_at),
    customerName: o.customer_name,
    phone: o.customer_phone,
    email: o.customer_email,
    addressLine: o.address_line,
    city: o.city,
    state: o.state,
    pincode: o.pincode,
    paymentMethod: o.payment_method,
    paymentLabel: PAYMENT_LABELS[o.payment_method] ?? o.payment_method,
    subtotalPaise: o.subtotal_paise,
    discountPaise: o.discount_paise,
    shippingPaise: o.shipping_paise,
    totalPaise: o.total_paise,
    itemCount: items.reduce((n, it) => n + it.qty, 0),
    items: items.map((it) => ({
      name: it.name,
      tone: it.tone,
      qty: it.qty,
      lineTotalPaise: it.line_total_paise,
    })),
    awb: o.awb,
    trackingUrl: o.tracking_url,
    // Without history context this order is at least the customer's first.
    customerOrderCount: history?.orders ?? 1,
    customerCancelledCount: history?.cancelled ?? 0,
    events: [placed, ...auditEvents],
  }
}

/** One row of the CA-facing CSV export (5.18) — flat, no line items. */
export type ExportOrderRow = {
  orderNo: string
  /** IST calendar date, sortable: "2026-07-06". */
  date: string
  status: string
  payment: string
  customer: string
  phone: string
  email: string
  city: string
  state: string
  pincode: string
  couponCode: string
  subtotalPaise: number
  discountPaise: number
  shippingPaise: number
  totalPaise: number
}

/** Same cap as the subscribers export — far above current volume. */
export const EXPORT_ORDERS_CAP = 5000

/**
 * Every order (newest first, capped) for the Export CSV action (5.18) — the
 * accountant wants the lot, not a page. Behind the admin gate + admin-read
 * RLS like the queue; empty on error (the action surfaces a message).
 */
export async function getAllOrdersForExport(): Promise<ExportOrderRow[]> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from("order")
      .select(
        "order_no, created_at, status, payment_method, customer_name, customer_phone, customer_email, city, state, pincode, coupon_code, subtotal_paise, discount_paise, shipping_paise, total_paise",
      )
      .order("created_at", { ascending: false })
      .limit(EXPORT_ORDERS_CAP)
    return (data ?? []).map((o) => ({
      orderNo: o.order_no,
      date: new Date(o.created_at).toLocaleDateString("en-CA", {
        timeZone: IST,
      }),
      status: o.status,
      payment: PAYMENT_LABELS[o.payment_method] ?? o.payment_method,
      customer: o.customer_name,
      phone: o.customer_phone,
      email: o.customer_email,
      city: o.city,
      state: o.state,
      pincode: o.pincode,
      couponCode: o.coupon_code ?? "",
      subtotalPaise: o.subtotal_paise,
      discountPaise: o.discount_paise,
      shippingPaise: o.shipping_paise,
      totalPaise: o.total_paise,
    }))
  } catch (err) {
    console.error("[admin-read] orders export failed:", err)
    return []
  }
}

/**
 * One order by its order number (5.12 — the print invoice/packing-slip page).
 * Same admin-RLS read path as the queue; returns null when missing so the page
 * can 404.
 */
export async function getAdminOrderByNo(orderNo: string): Promise<AdminOrderRow | null> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from("order")
      .select(SELECT)
      .eq("order_no", orderNo)
      .maybeSingle()
    if (!data) return null
    const row = data as OrderSelectRow
    const [{ data: hist }, { data: audit }] = await Promise.all([
      supabase
        .from("order")
        .select("customer_phone, status")
        .eq("customer_phone", row.customer_phone),
      supabase
        .from("admin_audit_log")
        .select(AUDIT_SELECT)
        .eq("entity_type", "order")
        .eq("entity_id", row.order_no)
        .in("action", TIMELINE_ACTIONS)
        .order("created_at", { ascending: true }),
    ])
    return mapOrderRow(
      row,
      tallyHistory(hist ?? []).get(row.customer_phone),
      groupEvents((audit ?? []) as AuditSelectRow[]).get(row.order_no) ?? [],
    )
  } catch (err) {
    console.error("[admin-read] order-by-no failed:", err)
    return null
  }
}

export async function listAdminOrders(opts: {
  filter: OrderFilter
  page: number
  search?: string
  range: OrderDateRange
}): Promise<AdminRead<AdminOrdersPage>> {
  const filter = opts.filter
  const page = Math.max(1, opts.page)
  const search = (opts.search ?? "").trim()
  const range = opts.range
  const orFilter = buildOrderSearchOr(search)
  // IST day bounds: >= midnight of `from`, < midnight after `to` (inclusive).
  const sinceIso = range.from ? istDayStartIso(range.from) : null
  const untilIso = range.to ? istDayStartIso(shiftDate(range.to, 1)) : null

  return loadAdmin(
    "orders",
    async () => {
      const supabase = await createServerClient()

      // One exact head-count per status (scale-safe vs. tallying fetched rows) +
      // the current page of full rows — all in parallel. When a search is
      // active it's applied to every query so the tab counts and pagination
      // reflect the filtered result set, not the whole queue.
      const from = (page - 1) * ORDERS_PAGE_SIZE
      let rowsQuery = supabase
        .from("order")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .range(from, from + ORDERS_PAGE_SIZE - 1)
      if (filter !== "All") rowsQuery = rowsQuery.eq("status", filter)
      if (orFilter) rowsQuery = rowsQuery.or(orFilter)
      if (sinceIso) rowsQuery = rowsQuery.gte("created_at", sinceIso)
      if (untilIso) rowsQuery = rowsQuery.lt("created_at", untilIso)

      const [rowsRes, ...countRes] = await Promise.all([
        rowsQuery,
        ...ORDER_STATUSES.map((s) => {
          let q = supabase.from("order").select("*", { count: "exact", head: true }).eq("status", s)
          if (orFilter) q = q.or(orFilter)
          if (sinceIso) q = q.gte("created_at", sinceIso)
          if (untilIso) q = q.lt("created_at", untilIso)
          return q
        }),
      ])

      const counts = { ...EMPTY_COUNTS }
      let all = 0
      ORDER_STATUSES.forEach((s, i) => {
        const c = countRes[i].count ?? 0
        counts[s] = c
        all += c
      })
      counts.All = all

      const total = counts[filter]
      const pageCount = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE))

      // Two bounded companion reads over just this page's rows, in parallel:
      // customer history by phone (5.15) and the audit timeline by order no
      // (5.16 — status changes + notes).
      const rawRows = (rowsRes.data ?? []) as OrderSelectRow[]
      const phones = [...new Set(rawRows.map((o) => o.customer_phone))].filter(Boolean)
      let historyByPhone = new Map<string, CustomerHistory>()
      let eventsByOrder = new Map<string, OrderEvent[]>()
      if (rawRows.length > 0) {
        const [{ data: hist }, { data: audit }] = await Promise.all([
          phones.length > 0
            ? supabase.from("order").select("customer_phone, status").in("customer_phone", phones)
            : Promise.resolve({ data: [] }),
          supabase
            .from("admin_audit_log")
            .select(AUDIT_SELECT)
            .eq("entity_type", "order")
            .in(
              "entity_id",
              rawRows.map((o) => o.order_no),
            )
            .in("action", TIMELINE_ACTIONS)
            .order("created_at", { ascending: true }),
        ])
        historyByPhone = tallyHistory(hist ?? [])
        eventsByOrder = groupEvents((audit ?? []) as AuditSelectRow[])
      }

      const rows: AdminOrderRow[] = rawRows.map((o) =>
        mapOrderRow(o, historyByPhone.get(o.customer_phone), eventsByOrder.get(o.order_no) ?? []),
      )

      return { rows, counts, filter, search, range, page, pageCount, total }
    },
    emptyPage(filter, search, range, page),
  )
}

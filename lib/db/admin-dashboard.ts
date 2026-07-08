import "server-only"
import { statusChip, type StatusChip } from "@/lib/admin/order-status"
import { type AdminRead, loadAdmin } from "./admin-read"
import { createServerClient } from "./server"

/**
 * Dashboard aggregates for the admin console (Phase 3.2). Reads order / order_item
 * / product via the admin's own cookie session — the `is_admin()` RLS policies
 * (0006) permit it, so no service-role key is needed. Degrades to an empty
 * dashboard on any error so the chrome always renders.
 *
 * Day bucketing uses IST (the store's timezone) so "today" and the 7-day chart
 * line up with the operator's day, not UTC.
 */

const DAY_MS = 86_400_000
const LOW_STOCK_THRESHOLD = 5
const IST = "Asia/Kolkata"

export type DashboardKpis = {
  /** Orders *placed* today, all statuses (activity headline). */
  ordersToday: number
  /** How many of today's orders are cancelled — surfaced so the revenue gap is
   * explained (Revenue Today excludes cancelled). 0 when none. */
  cancelledToday: number
  /** % change vs yesterday, or null when yesterday had none (no baseline). */
  ordersDeltaPct: number | null
  revenueTodayPaise: number
  revenueDeltaPct: number | null
  pendingOrders: number
  lowStockCount: number
}
export type RevenueBar = { day: string; revenuePaise: number; isPeak: boolean }
export type RecentOrderRow = {
  orderNo: string
  customer: string
  city: string
  state: string
  dateLabel: string
  totalPaise: number
  chip: StatusChip
}
export type LowStockRow = { name: string; sku: string; stock: number }
export type TopSellerRow = { name: string; units: number; revenuePaise: number }

export type DashboardData = {
  kpis: DashboardKpis
  revenue7d: RevenueBar[]
  recentOrders: RecentOrderRow[]
  lowStock: LowStockRow[]
  topSellers: TopSellerRow[]
}

const EMPTY: DashboardData = {
  kpis: {
    ordersToday: 0,
    cancelledToday: 0,
    ordersDeltaPct: null,
    revenueTodayPaise: 0,
    revenueDeltaPct: null,
    pendingOrders: 0,
    lowStockCount: 0,
  },
  revenue7d: [],
  recentOrders: [],
  lowStock: [],
  topSellers: [],
}

/** IST calendar day key, e.g. "2026-07-04". */
function istKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: IST })
}
/** Short IST weekday, e.g. "Sat". */
function istWeekday(d: Date): string {
  return d.toLocaleDateString("en-US", { timeZone: IST, weekday: "short" })
}
/** Short IST date, e.g. "04 Jul". */
function istDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
  })
}
function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export async function getDashboardData(): Promise<AdminRead<DashboardData>> {
  return loadAdmin(
    "dashboard",
    async () => {
      const supabase = await createServerClient()
      const now = new Date()
      const windowStart = new Date(now.getTime() - 7 * DAY_MS)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const [windowRes, recentRes, pendingRes, lowStockRes, lowStockCountRes, monthOrdersRes] =
        await Promise.all([
          supabase
            .from("order")
            .select("total_paise, status, created_at")
            .gte("created_at", windowStart.toISOString()),
          supabase
            .from("order")
            .select("order_no, customer_name, city, state, total_paise, status, created_at")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("order")
            .select("*", { count: "exact", head: true })
            .eq("status", "Pending"),
          supabase
            .from("product")
            .select("name, sku, stock")
            .lte("stock", LOW_STOCK_THRESHOLD)
            .order("stock", { ascending: true })
            .limit(5),
          supabase
            .from("product")
            .select("*", { count: "exact", head: true })
            .lte("stock", LOW_STOCK_THRESHOLD),
          supabase
            .from("order")
            .select("id")
            .gte("created_at", monthStart.toISOString())
            .neq("status", "Cancelled"),
        ])

      // Revenue + order counts bucketed by IST day. `ordersByDay` counts every
      // order placed that day (activity); `revenueByDay` and `cancelledByDay`
      // split out cancelled ones so Revenue Today and the "N cancelled" note stay
      // consistent with each other.
      const revenueByDay = new Map<string, number>()
      const ordersByDay = new Map<string, number>()
      const cancelledByDay = new Map<string, number>()
      for (const o of windowRes.data ?? []) {
        const key = istKey(new Date(o.created_at))
        ordersByDay.set(key, (ordersByDay.get(key) ?? 0) + 1)
        if (o.status === "Cancelled") {
          cancelledByDay.set(key, (cancelledByDay.get(key) ?? 0) + 1)
        } else {
          revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + o.total_paise)
        }
      }
      const bars: RevenueBar[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * DAY_MS)
        bars.push({
          day: istWeekday(d),
          revenuePaise: revenueByDay.get(istKey(d)) ?? 0,
          isPeak: false,
        })
      }
      const peak = Math.max(0, ...bars.map((b) => b.revenuePaise))
      const revenue7d = bars.map((b) => ({
        ...b,
        isPeak: peak > 0 && b.revenuePaise === peak,
      }))

      const todayKey = istKey(now)
      const yKey = istKey(new Date(now.getTime() - DAY_MS))
      const ordersToday = ordersByDay.get(todayKey) ?? 0
      const revenueTodayPaise = revenueByDay.get(todayKey) ?? 0

      const recentOrders: RecentOrderRow[] = (recentRes.data ?? []).map((o) => ({
        orderNo: o.order_no,
        customer: o.customer_name,
        city: o.city,
        state: o.state,
        dateLabel: istDateLabel(o.created_at),
        totalPaise: o.total_paise,
        chip: statusChip(o.status),
      }))

      const lowStock: LowStockRow[] = (lowStockRes.data ?? []).map((p) => ({
        name: p.name,
        sku: p.sku,
        stock: p.stock ?? 0,
      }))

      // Top sellers: this month's (non-cancelled) order items, aggregated by product.
      const monthOrderIds = (monthOrdersRes.data ?? []).map((o) => o.id)
      const agg = new Map<string, TopSellerRow>()
      if (monthOrderIds.length > 0) {
        const itemsRes = await supabase
          .from("order_item")
          .select("product_id, name, qty, line_total_paise")
          .in("order_id", monthOrderIds)
        for (const it of itemsRes.data ?? []) {
          const cur = agg.get(it.product_id) ?? {
            name: it.name,
            units: 0,
            revenuePaise: 0,
          }
          cur.units += it.qty
          cur.revenuePaise += it.line_total_paise
          agg.set(it.product_id, cur)
        }
      }
      const topSellers = [...agg.values()].sort((a, b) => b.units - a.units).slice(0, 4)

      return {
        kpis: {
          ordersToday,
          cancelledToday: cancelledByDay.get(todayKey) ?? 0,
          ordersDeltaPct: deltaPct(ordersToday, ordersByDay.get(yKey) ?? 0),
          revenueTodayPaise,
          revenueDeltaPct: deltaPct(revenueTodayPaise, revenueByDay.get(yKey) ?? 0),
          pendingOrders: pendingRes.count ?? 0,
          lowStockCount: lowStockCountRes.count ?? 0,
        },
        revenue7d,
        recentOrders,
        lowStock,
        topSellers,
      }
    },
    EMPTY,
  )
}

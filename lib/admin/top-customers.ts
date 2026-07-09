/**
 * Top customers by revenue (TASKS 6.14). Pure aggregation over a flat order
 * read so it unit-tests without a DB. Customers are keyed by phone — the 5.15
 * precedent (one person, possibly several checkout emails/name spellings) —
 * and cancelled orders count for nothing (revenue-consistent with the
 * dashboard KPIs, which exclude Cancelled).
 */

export type CustomerOrderLite = {
  customerName: string
  customerPhone: string
  totalPaise: number
  status: string
}

export type TopCustomerRow = {
  /** First-seen name — pass rows newest-first so renames show the latest. */
  name: string
  phone: string
  /** Non-cancelled orders. */
  orders: number
  /** Non-cancelled revenue. */
  revenuePaise: number
}

const DEFAULT_LIMIT = 5

/** Aggregate → sort by revenue desc → cap. Zero-revenue customers are dropped. */
export function aggregateTopCustomers(
  rows: readonly CustomerOrderLite[],
  limit: number = DEFAULT_LIMIT,
): TopCustomerRow[] {
  const byPhone = new Map<string, TopCustomerRow>()
  for (const row of rows) {
    if (row.status === "Cancelled") continue
    const existing = byPhone.get(row.customerPhone)
    if (existing) {
      byPhone.set(row.customerPhone, {
        ...existing,
        orders: existing.orders + 1,
        revenuePaise: existing.revenuePaise + row.totalPaise,
      })
    } else {
      byPhone.set(row.customerPhone, {
        name: row.customerName,
        phone: row.customerPhone,
        orders: 1,
        revenuePaise: row.totalPaise,
      })
    }
  }
  return [...byPhone.values()].sort((a, b) => b.revenuePaise - a.revenuePaise).slice(0, limit)
}

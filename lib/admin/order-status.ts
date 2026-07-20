/**
 * Order status chip metadata — the fulfilment states from the `order` table
 * (`supabase/migrations/0001_initial_schema.sql`) mapped to a label + admin chip colours. Shared by
 * the dashboard, the orders list, and the order drawer so a status always looks
 * the same across the console.
 */
export type OrderStatus = "Pending" | "Confirmed" | "Packed" | "Shipped" | "Delivered" | "Cancelled"

export type StatusChip = { label: string; color: string; bg: string }

const CHIPS: Record<OrderStatus, StatusChip> = {
  Pending: { label: "Pending", color: "#B7791F", bg: "#FBF1DD" },
  Confirmed: { label: "Confirmed", color: "#1B6FA8", bg: "#E4F0F8" },
  Packed: { label: "Packed", color: "#7A5CB5", bg: "#EFEAF9" },
  Shipped: { label: "Shipped", color: "#A8651B", bg: "#F7ECDA" },
  Delivered: { label: "Delivered", color: "#1B7A3D", bg: "#E7F3EB" },
  Cancelled: { label: "Cancelled", color: "#C0392F", bg: "#FBE9E7" },
}

const FALLBACK: StatusChip = { label: "—", color: "#8A7E74", bg: "#F1ECE3" }

export function statusChip(status: string): StatusChip {
  return CHIPS[status as OrderStatus] ?? { ...FALLBACK, label: status }
}

/**
 * The linear fulfilment flow. An order advances one step at a time along this
 * path; `Cancelled` sits outside it (reachable from any non-terminal state).
 * Kept in lockstep with the `admin_set_order_status` RPC (0007), which enforces
 * the same rules server-side.
 */
export const ORDER_FLOW: OrderStatus[] = ["Pending", "Confirmed", "Packed", "Shipped", "Delivered"]

/** Every status, including the off-flow `Cancelled` — the admin filter tabs. */
export const ORDER_STATUSES: OrderStatus[] = [...ORDER_FLOW, "Cancelled"]

/** Orders shown per page in the admin queue. */
export const ORDERS_PAGE_SIZE = 6

/** The next fulfilment status, or null if the order is at the end / off-flow. */
export function nextStatus(status: string): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(status as OrderStatus)
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null
}

/**
 * One step back along the flow (6.5) — for undoing a mis-click. Null at the
 * start of the flow and for terminal/off-flow statuses; the RPC enforces the
 * same rule server-side (Delivered/Cancelled never move).
 */
export function prevStatus(status: string): OrderStatus | null {
  if (status === "Delivered" || status === "Cancelled") return null
  const i = ORDER_FLOW.indexOf(status as OrderStatus)
  return i > 0 ? ORDER_FLOW[i - 1] : null
}

/** Primary action label, e.g. "Mark as Shipped" — null when nothing to advance. */
export function advanceLabel(status: string): string | null {
  const next = nextStatus(status)
  return next ? `Mark as ${next}` : null
}

/** An order can be cancelled from any state that isn't already terminal. */
export function canCancel(status: string): boolean {
  return status !== "Delivered" && status !== "Cancelled"
}

export type StepState = "done" | "active" | "upcoming"
export type OrderStep = { label: OrderStatus; state: StepState }

/**
 * The 5-step fulfilment stepper for a given status: everything before the
 * current step is `done`, the current step is `active`, the rest `upcoming`.
 * Returns null for `Cancelled` — the drawer shows a cancelled notice instead of
 * a progress track (the pre-cancel step isn't recorded).
 */
export function buildStepper(status: string): OrderStep[] | null {
  if (status === "Cancelled") return null
  const current = ORDER_FLOW.indexOf(status as OrderStatus)
  const ci = current < 0 ? 0 : current
  return ORDER_FLOW.map((label, i) => ({
    label,
    state: i < ci ? "done" : i === ci ? "active" : "upcoming",
  }))
}

/**
 * Order status chip metadata — the fulfilment states from the `order` table
 * (`0001_create_orders.sql`) mapped to a label + admin chip colours. Shared by
 * the dashboard, the orders list, and the order drawer so a status always looks
 * the same across the console.
 */
export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Packed"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

export type StatusChip = { label: string; color: string; bg: string };

const CHIPS: Record<OrderStatus, StatusChip> = {
  Pending: { label: "Pending", color: "#B7791F", bg: "#FBF1DD" },
  Confirmed: { label: "Confirmed", color: "#1B6FA8", bg: "#E4F0F8" },
  Packed: { label: "Packed", color: "#7A5CB5", bg: "#EFEAF9" },
  Shipped: { label: "Shipped", color: "#A8651B", bg: "#F7ECDA" },
  Delivered: { label: "Delivered", color: "#1B7A3D", bg: "#E7F3EB" },
  Cancelled: { label: "Cancelled", color: "#C0392F", bg: "#FBE9E7" },
};

const FALLBACK: StatusChip = { label: "—", color: "#8A7E74", bg: "#F1ECE3" };

export function statusChip(status: string): StatusChip {
  return CHIPS[status as OrderStatus] ?? { ...FALLBACK, label: status };
}

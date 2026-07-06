import "server-only";
import {
  ORDER_STATUSES,
  ORDERS_PAGE_SIZE,
  type OrderStatus,
} from "@/lib/admin/order-status";
import { type AdminRead, loadAdmin } from "./admin-read";
import { createServerClient } from "./server";

/**
 * Admin order queue (Phase 3.3). Reads `order` + `order_item` through the
 * admin's own cookie session — the `is_admin()` RLS policies (0006) permit it,
 * so no service-role key is needed. Each returned row carries the *full* order
 * (customer, address, money, line items) so the client can open the fulfilment
 * drawer instantly without a second round-trip.
 */

// Re-exported for server-side callers; client components import these from
// @/lib/admin/order-status directly (this module is server-only).
export { ORDER_STATUSES, ORDERS_PAGE_SIZE };

/** Filter key for the queue — a real status or the catch-all "All". */
export type OrderFilter = "All" | OrderStatus;

export type AdminOrderItem = {
  name: string;
  tone: string | null;
  qty: number;
  lineTotalPaise: number;
};

export type AdminOrderRow = {
  id: string;
  orderNo: string;
  status: string;
  createdAt: string;
  dateLabel: string;
  customerName: string;
  phone: string;
  email: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: string;
  paymentLabel: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  itemCount: number;
  items: AdminOrderItem[];
  awb: string | null;
};

/** Tab counts: one per status plus the "All" total. */
export type OrderCounts = Record<OrderFilter, number>;

export type AdminOrdersPage = {
  rows: AdminOrderRow[];
  counts: OrderCounts;
  filter: OrderFilter;
  page: number;
  pageCount: number;
  total: number;
};

const IST = "Asia/Kolkata";
const PAYMENT_LABELS: Record<string, string> = {
  cod: "COD",
  razorpay: "Razorpay",
};

/** IST date, e.g. "04 Jul 2026". */
function istDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Coerce an untrusted `?status=` value to a valid filter (defaults to All). */
export function toOrderFilter(value: string | undefined): OrderFilter {
  return value && (ORDER_STATUSES as string[]).includes(value)
    ? (value as OrderFilter)
    : "All";
}

// One string literal (not concatenated) so supabase-js can infer the embedded
// order_item relation type from the select.
const SELECT =
  "id, order_no, status, created_at, customer_name, customer_phone, customer_email, address_line, city, state, pincode, payment_method, subtotal_paise, discount_paise, shipping_paise, total_paise, awb, order_item(name, tone, qty, line_total_paise)";

const EMPTY_COUNTS: OrderCounts = {
  All: 0,
  Pending: 0,
  Confirmed: 0,
  Packed: 0,
  Shipped: 0,
  Delivered: 0,
  Cancelled: 0,
};

function emptyPage(filter: OrderFilter, page: number): AdminOrdersPage {
  return {
    rows: [],
    counts: EMPTY_COUNTS,
    filter,
    page,
    pageCount: 0,
    total: 0,
  };
}

export async function listAdminOrders(opts: {
  filter: OrderFilter;
  page: number;
}): Promise<AdminRead<AdminOrdersPage>> {
  const filter = opts.filter;
  const page = Math.max(1, opts.page);

  return loadAdmin(
    "orders",
    async () => {
      const supabase = await createServerClient();

      // One exact head-count per status (scale-safe vs. tallying fetched rows) +
      // the current page of full rows — all in parallel.
      const from = (page - 1) * ORDERS_PAGE_SIZE;
      let rowsQuery = supabase
        .from("order")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .range(from, from + ORDERS_PAGE_SIZE - 1);
      if (filter !== "All") rowsQuery = rowsQuery.eq("status", filter);

      const [rowsRes, ...countRes] = await Promise.all([
        rowsQuery,
        ...ORDER_STATUSES.map((s) =>
          supabase
            .from("order")
            .select("*", { count: "exact", head: true })
            .eq("status", s),
        ),
      ]);

      const counts = { ...EMPTY_COUNTS };
      let all = 0;
      ORDER_STATUSES.forEach((s, i) => {
        const c = countRes[i].count ?? 0;
        counts[s] = c;
        all += c;
      });
      counts.All = all;

      const total = counts[filter];
      const pageCount = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));

      const rows: AdminOrderRow[] = (rowsRes.data ?? []).map((o) => {
        const items = o.order_item ?? [];
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
        };
      });

      return { rows, counts, filter, page, pageCount, total };
    },
    emptyPage(filter, page),
  );
}

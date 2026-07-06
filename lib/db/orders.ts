import "server-only";
import {
  type OrderConfirmation,
  toOrderConfirmation,
} from "@/lib/checkout/order";
import { createServerClient } from "./server";

/**
 * Fetch the confirmation view of one order by its (unguessable) order number,
 * via the read-only `get_order_confirmation` SECURITY DEFINER RPC — the `order`
 * table itself is RLS-sealed. Returns null when the number is unknown so the
 * page can `notFound()`. Throws on an unexpected RPC error.
 */
export async function getOrderConfirmation(
  orderNo: string,
): Promise<OrderConfirmation | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_order_confirmation", {
    p_order_no: orderNo,
  });

  if (error) {
    throw new Error(`getOrderConfirmation failed: ${error.message}`);
  }

  return toOrderConfirmation(data);
}

/** One row of the signed-in customer's order history. */
export type MyOrderSummary = {
  orderNo: string;
  status: string;
  createdAt: string;
  totalPaise: number;
  itemCount: number;
};

/**
 * The signed-in customer's orders, newest first. Runs as the user through the
 * cookie-aware client, so the "customer reads own orders" RLS policy scopes
 * the rows — no explicit user filter needed (and none would be trustworthy).
 */
export async function listMyOrders(): Promise<MyOrderSummary[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("order")
    .select("order_no, status, created_at, total_paise, order_item(count)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`listMyOrders failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    orderNo: row.order_no,
    status: row.status,
    createdAt: row.created_at,
    totalPaise: row.total_paise,
    itemCount: row.order_item[0]?.count ?? 0,
  }));
}

/** One line item on an order detail view. */
export type MyOrderItem = {
  name: string;
  tone: string | null;
  qty: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

/** Full detail for one of the signed-in customer's own orders (TASKS 4.14). */
export type MyOrderDetail = {
  orderNo: string;
  status: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  items: MyOrderItem[];
};

/**
 * Full detail for one order, scoped to the signed-in customer via the same
 * "customer reads own orders"/"customer reads own order items" RLS policies
 * as `listMyOrders` — no explicit user filter needed (and none would be
 * trustworthy). Returns null when the order number doesn't exist OR belongs
 * to someone else, so the page can `notFound()` either way.
 */
export async function getMyOrderDetail(
  orderNo: string,
): Promise<MyOrderDetail | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("order")
    .select(
      "order_no, status, created_at, customer_name, customer_phone, customer_email, address_line, city, state, pincode, subtotal_paise, discount_paise, shipping_paise, total_paise, order_item(name, tone, qty, unit_price_paise, line_total_paise)",
    )
    .eq("order_no", orderNo)
    .maybeSingle();

  if (error) {
    throw new Error(`getMyOrderDetail failed: ${error.message}`);
  }
  if (!data) return null;

  return {
    orderNo: data.order_no,
    status: data.status,
    createdAt: data.created_at,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerEmail: data.customer_email,
    addressLine: data.address_line,
    city: data.city,
    state: data.state,
    pincode: data.pincode,
    subtotalPaise: data.subtotal_paise,
    discountPaise: data.discount_paise,
    shippingPaise: data.shipping_paise,
    totalPaise: data.total_paise,
    items: data.order_item.map((item) => ({
      name: item.name,
      tone: item.tone,
      qty: item.qty,
      unitPricePaise: item.unit_price_paise,
      lineTotalPaise: item.line_total_paise,
    })),
  };
}

/**
 * Whether the signed-in customer has a Delivered order containing this
 * product — the "Verified Purchase" gate for review submission (TASKS 4.15
 * follow-up). Scoped by the same "customer reads own orders"/"own order
 * items" RLS policies as the rest of this file; mirrors the check the
 * `submit_review` RPC (0022) enforces server-side regardless.
 */
export async function hasDeliveredPurchase(productId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("order")
    .select("id, order_item!inner(product_id)")
    .eq("status", "Delivered")
    .eq("order_item.product_id", productId)
    .limit(1);

  if (error) {
    throw new Error(`hasDeliveredPurchase failed: ${error.message}`);
  }
  return (data ?? []).length > 0;
}

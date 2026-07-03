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

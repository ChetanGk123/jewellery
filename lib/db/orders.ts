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
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("get_order_confirmation", {
    p_order_no: orderNo,
  });

  if (error) {
    throw new Error(`getOrderConfirmation failed: ${error.message}`);
  }

  return toOrderConfirmation(data);
}

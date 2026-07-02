import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderConfirmation } from "@/components/storefront/order/OrderConfirmation";
import { getOrderConfirmation } from "@/lib/db/orders";

export const metadata: Metadata = {
  title: "Order confirmed",
  description: "Your Cash on Delivery order has been placed.",
  robots: { index: false, follow: false },
};

type OrderPageProps = {
  params: Promise<{ id: string }>;
};

/** Matches a v4-shaped UUID before hitting the DB, so a junk path 404s cleanly. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Order confirmation page (TASKS 2.6). Reached via the checkout redirect keyed
 * on the order's unguessable id. Fetches the non-sensitive confirmation through
 * the `get_order_confirmation` RPC (the `order` table is RLS-sealed) and 404s
 * for an unknown or malformed id.
 */
export default async function OrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const confirmation = await getOrderConfirmation(id);
  if (!confirmation) notFound();

  return <OrderConfirmation confirmation={confirmation} />;
}

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OrderDetail } from "@/components/storefront/order/OrderDetail";
import { ORDER_NO_RE } from "@/lib/checkout/order";
import { getMyOrderDetail } from "@/lib/db/orders";
import { getCurrentUser } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Order Detail",
  robots: { index: false },
};

type OrderDetailPageProps = {
  params: Promise<{ orderNo: string }>;
};

/**
 * Signed-in order detail (TASKS 4.14) — items, address, status timeline, and
 * cancel-while-Pending. Distinct from `/order/[orderNo]` (the unguessable-URL
 * post-checkout confirmation, no sign-in required): this route is reached
 * only from "My Orders" and requires the session to own the order (enforced
 * by RLS in `getMyOrderDetail`, not just the sign-in redirect below).
 */
export default async function AccountOrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { orderNo } = await params;
  const decoded = decodeURIComponent(orderNo);

  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.accountOrder(decoded))}`,
    );
  }

  if (!ORDER_NO_RE.test(decoded)) notFound();

  const order = await getMyOrderDetail(decoded);
  if (!order) notFound();

  return <OrderDetail order={order} />;
}

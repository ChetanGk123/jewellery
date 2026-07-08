import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { OrderConfirmation } from "@/components/storefront/order/OrderConfirmation"
import { ORDER_NO_RE } from "@/lib/checkout/order"
import { getOrderConfirmation } from "@/lib/db/orders"
import { isEmailEnabled } from "@/lib/email/send"

export const metadata: Metadata = {
  title: "Order confirmed",
  description: "Your Cash on Delivery order has been placed.",
  robots: { index: false, follow: false },
}

type OrderPageProps = {
  params: Promise<{ orderNo: string }>
  searchParams: Promise<{ coupon?: string }>
}

/**
 * Order confirmation page (TASKS 2.6). Reached via the checkout redirect keyed
 * on the order number, which carries a random suffix so it can't be enumerated.
 * Fetches the non-sensitive confirmation through the `get_order_confirmation`
 * RPC (the `order` table is RLS-sealed) and 404s for an unknown/malformed number.
 */
export default async function OrderPage({ params, searchParams }: OrderPageProps) {
  const { orderNo } = await params
  const { coupon } = await searchParams
  const decoded = decodeURIComponent(orderNo)
  if (!ORDER_NO_RE.test(decoded)) notFound()

  const confirmation = await getOrderConfirmation(decoded)
  if (!confirmation) notFound()

  return (
    <OrderConfirmation
      confirmation={confirmation}
      couponDropped={coupon === "dropped"}
      emailSent={isEmailEnabled()}
    />
  )
}

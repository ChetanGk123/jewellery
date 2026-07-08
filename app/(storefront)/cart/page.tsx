import type { Metadata } from "next"
import { CartView } from "@/components/storefront/cart/CartView"
import { getActiveCoupons } from "@/lib/db/coupons"
import { getStoreSettings } from "@/lib/db/settings"

export const metadata: Metadata = {
  title: "Your Cart",
  description: "Review the bridal jewellery in your cart and check out with Cash on Delivery.",
}

/**
 * Cart page (TASKS 2.2). A thin server shell that supplies the store's free-ship
 * threshold; the cart itself is client-side (localStorage via `useCartStore`),
 * so all rendering happens in `CartView`.
 */
export default async function CartPage() {
  const [settings, coupons] = await Promise.all([getStoreSettings(), getActiveCoupons()])

  return (
    <main className="mx-auto max-w-[1180px] flex-1 px-6 pb-20 pt-[30px]">
      <h1 className="mb-7 font-heading text-[44px] font-semibold leading-none text-maroon-900">
        Your Cart
      </h1>
      <CartView
        freeShipThresholdPaise={settings.freeShipThresholdPaise}
        flatRatePaise={settings.flatRatePaise}
        coupons={coupons}
      />
    </main>
  )
}

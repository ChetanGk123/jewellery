import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutView } from "@/components/storefront/checkout/CheckoutView";
import { ROUTES } from "@/lib/routes";
import { getStoreSettings } from "@/lib/db/settings";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Enter your delivery details and place your Cash on Delivery order.",
};

/**
 * Checkout page (TASKS 2.4). A thin server shell supplying the store's free-ship
 * threshold; the cart, totals, form, and validation all live client-side in
 * `CheckoutView` (the cart is persisted in localStorage via `useCartStore`).
 */
export default async function CheckoutPage() {
  const settings = await getStoreSettings();

  return (
    <main className="mx-auto max-w-[1180px] flex-1 px-6 pb-20 pt-[30px]">
      <nav
        aria-label="Breadcrumb"
        className="mb-[18px] text-[12px] leading-none text-[#9C8A84]"
      >
        <Link href={ROUTES.cart} className="text-maroon-700 hover:underline">
          Cart
        </Link>
        <span className="px-2">/</span>
        <span>Checkout</span>
      </nav>
      <h1 className="mb-7 font-heading text-[44px] font-semibold leading-none text-maroon-900">
        Checkout
      </h1>
      <CheckoutView freeShipThresholdPaise={settings.freeShipThresholdPaise} />
    </main>
  );
}

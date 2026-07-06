import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutView } from "@/components/storefront/checkout/CheckoutView";
import { profileToCheckoutDefaults } from "@/lib/account/profile";
import { getCustomerProfile } from "@/lib/db/profile";
import { getCurrentUser } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";
import { getActiveCoupons } from "@/lib/db/coupons";
import { getStoreSettings } from "@/lib/db/settings";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Enter your delivery details and place your Cash on Delivery order.",
};

/**
 * Checkout page (TASKS 2.4). Sign-in required (checkout is account-only): the
 * gate redirects to sign-in and returns here. The server shell supplies the
 * free-ship threshold plus form defaults prefilled from the customer's saved
 * profile + account email; cart, totals and validation live client-side in
 * `CheckoutView`.
 */
export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.checkout)}`);
  }

  const [settings, profile, coupons] = await Promise.all([
    getStoreSettings(),
    getCustomerProfile(user.id),
    getActiveCoupons(),
  ]);
  const defaults = profileToCheckoutDefaults(profile, user.email ?? "");

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
      <CheckoutView
        freeShipThresholdPaise={settings.freeShipThresholdPaise}
        flatRatePaise={settings.flatRatePaise}
        codEnabled={settings.codEnabled}
        defaults={defaults}
        coupons={coupons}
      />
    </main>
  );
}

import { CartSync } from "@/components/storefront/cart/CartSync"
import { Header } from "@/components/storefront/layout/Header"
import { Footer } from "@/components/storefront/layout/Footer"
import { getStoreInfo, getStoreSettings } from "@/lib/db/settings"

/**
 * Storefront chrome. Scoped to the `(storefront)` route group so the customer
 * Header/Footer (and the settings fetch that feeds the announcement bar) apply
 * only here — the admin console (Phase 3) gets its own layout, not this one.
 */
export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Both cached (settings tag) + deduped per render, so fetching in parallel
  // here and passing down keeps Header/Footer prop-driven (6.15).
  const [settings, info] = await Promise.all([getStoreSettings(), getStoreInfo()])

  return (
    <>
      <Header banner={settings.banner} info={info} />
      {children}
      <Footer info={info} />
      {/* Mirrors the cart server-side for abandoned-cart reminders (6.19). */}
      <CartSync />
    </>
  )
}

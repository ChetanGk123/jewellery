import { Header } from "@/components/storefront/layout/Header"
import { Footer } from "@/components/storefront/layout/Footer"
import { getStoreSettings } from "@/lib/db/settings"

/**
 * Storefront chrome. Scoped to the `(storefront)` route group so the customer
 * Header/Footer (and the settings fetch that feeds the announcement bar) apply
 * only here — the admin console (Phase 3) gets its own layout, not this one.
 */
export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getStoreSettings()

  return (
    <>
      <Header banner={settings.banner} />
      {children}
      <Footer />
    </>
  )
}

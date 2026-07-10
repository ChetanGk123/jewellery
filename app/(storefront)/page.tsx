import { Hero } from "@/components/storefront/home/Hero"
import { TrustStrip } from "@/components/storefront/home/TrustStrip"
import { CategoryTiles } from "@/components/storefront/home/CategoryTiles"
import { ProductSection } from "@/components/storefront/home/ProductSection"
import { PromoBanner } from "@/components/storefront/home/PromoBanner"
import { StoryBlock } from "@/components/storefront/home/StoryBlock"
import { getCategoryTiles, getFeaturedProducts, getFreshProducts } from "@/lib/db/queries"
import { getStoreSettings } from "@/lib/db/settings"
import { ROUTES } from "@/lib/routes"

/**
 * Storefront home page (TASKS 1.3) — mirrors the prototype's home route:
 * hero, trust strip, category tiles, bestsellers, promo banner, new arrivals
 * and a closing editorial block, all wired to live Supabase data.
 */
export default async function HomePage() {
  const [categories, featured, fresh, settings] = await Promise.all([
    getCategoryTiles(),
    getFeaturedProducts(8),
    getFreshProducts(8),
    getStoreSettings(),
  ])

  // Promote the first category that actually has products (else the first one).
  const heroCategory = categories.find((c) => c.productCount > 0) ?? categories[0] ?? null

  return (
    <main className="flex-1">
      <Hero ctaCategory={heroCategory} />
      <TrustStrip
        freeShipThresholdPaise={settings.freeShipThresholdPaise}
        codEnabled={settings.codEnabled}
      />
      <CategoryTiles categories={categories} />
      <ProductSection
        eyebrow="Most Loved"
        title="Bestselling Bridal Pieces"
        products={featured}
        viewAllHref={ROUTES.shop}
      />
      <PromoBanner promo={settings.promo} />
      <ProductSection eyebrow="Just In" title="New Arrivals" products={fresh} />
      <StoryBlock />
    </main>
  )
}

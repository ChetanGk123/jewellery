import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { ProductSection } from "@/components/home/ProductSection";
import { PromoBanner } from "@/components/home/PromoBanner";
import { StoryBlock } from "@/components/home/StoryBlock";
import {
  getCategoryTiles,
  getFeaturedProducts,
  getFreshProducts,
} from "@/lib/db/queries";
import { getStoreSettings } from "@/lib/db/settings";

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
  ]);

  return (
    <main className="flex-1">
      <Hero />
      <TrustStrip />
      <CategoryTiles categories={categories} />
      <ProductSection
        eyebrow="Most Loved"
        title="Bestselling Bridal Pieces"
        products={featured}
        viewAllHref="/shop"
      />
      <PromoBanner promo={settings.promo} />
      <ProductSection eyebrow="Just In" title="New Arrivals" products={fresh} />
      <StoryBlock />
    </main>
  );
}

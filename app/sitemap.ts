import type { MetadataRoute } from "next"
import { CATALOG_REVALIDATE_SECONDS } from "@/lib/db/cache"
import { getCategories, getProducts } from "@/lib/db/queries"
import { ROUTES } from "@/lib/routes"
import { SITE_URL } from "@/lib/site-url"

const STATIC_PATHS = [
  ROUTES.home,
  ROUTES.shop,
  ROUTES.about,
  ROUTES.care,
  ROUTES.contact,
  ROUTES.faq,
  ROUTES.shipping,
  ROUTES.privacy,
  ROUTES.terms,
  ROUTES.refundPolicy,
]

/**
 * This route is prerendered during `next build`, where the database may be
 * unreachable (a fresh Docker build has no network path to Supabase, and the
 * deploy must not hinge on the DB being up). Re-rendering on the ISR interval
 * means a sitemap built without a catalog repopulates itself once the DB is
 * back, instead of staying empty until the next deploy.
 *
 * Must be a literal: Next statically analyses segment config, so it cannot be
 * `CATALOG_REVALIDATE_SECONDS` — the assertion below keeps the two in step.
 */
export const revalidate = 300

const _revalidateMatchesCatalog: typeof revalidate = CATALOG_REVALIDATE_SECONDS
void _revalidateMatchesCatalog

/** Catalog half of the sitemap; `null` when the database is unreachable. */
async function getCatalog() {
  try {
    return await Promise.all([getCategories(), getProducts({ limit: 1000 })])
  } catch (error: unknown) {
    console.error("sitemap: catalog fetch failed, emitting static pages only", error)
    return null
  }
}

/**
 * Dynamic sitemap (TASKS 4.16) — static marketing/legal pages, every category,
 * and every storefront-visible product (excludes `Draft`, matching what the
 * storefront itself ever renders). Cart/checkout/account/auth routes are
 * deliberately excluded — see `app/robots.ts` for the matching disallow list.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = (await getCatalog()) ?? [[], []]

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === ROUTES.home ? 1 : 0.6,
  }))

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE_URL}${ROUTES.category(category.slug)}`,
    changeFrequency: "daily",
    priority: 0.7,
  }))

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${SITE_URL}${ROUTES.product(product.slug)}`,
    lastModified: product.created_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  return [...staticEntries, ...categoryEntries, ...productEntries]
}

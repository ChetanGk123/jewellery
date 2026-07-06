import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/db/queries";
import { ROUTES } from "@/lib/routes";
import { SITE_URL } from "@/lib/site-url";

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
];

/**
 * Dynamic sitemap (TASKS 4.16) — static marketing/legal pages, every category,
 * and every storefront-visible product (excludes `Draft`, matching what the
 * storefront itself ever renders). Cart/checkout/account/auth routes are
 * deliberately excluded — see `app/robots.ts` for the matching disallow list.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ limit: 1000 }),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === ROUTES.home ? 1 : 0.6,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE_URL}${ROUTES.category(category.slug)}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${SITE_URL}${ROUTES.product(product.slug)}`,
    lastModified: product.created_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries];
}

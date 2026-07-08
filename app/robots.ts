import type { MetadataRoute } from "next"
import { ROUTES } from "@/lib/routes"
import { SITE_URL } from "@/lib/site-url"

/**
 * robots.txt (TASKS 4.16) — disallows the account/auth/cart/checkout funnel
 * (session-scoped, no SEO value, several already carry `robots: {index:
 * false}` page metadata too) and the whole admin console. Everything else
 * (home, shop, categories, products, legal/help pages) is crawlable — see
 * `app/sitemap.ts` for the matching allow list.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        `${ROUTES.admin}`,
        `${ROUTES.admin}/`,
        `${ROUTES.account}`,
        `${ROUTES.account}/`,
        ROUTES.cart,
        ROUTES.checkout,
        ROUTES.signIn,
        ROUTES.signUp,
        ROUTES.forgotPassword,
        "/auth/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

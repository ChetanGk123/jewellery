import type { ProductDetail } from "@/lib/db/queries"
import { ROUTES } from "@/lib/routes"
import { SITE_URL } from "@/lib/site-url"
import { STORE_INFO } from "@/lib/store-info"

/** schema.org Organization for the site (TASKS 4.16) — rendered once in the root layout. */
export function buildOrganizationJsonLd() {
  const sameAs = STORE_INFO.socials
    .map((social) => social.href)
    .filter((href): href is string => Boolean(href))

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: STORE_INFO.name,
    url: SITE_URL,
    ...(sameAs.length > 0 ? { sameAs } : {}),
  }
}

/** schema.org Product + Offer (+ AggregateRating when reviewed) for a product detail page. */
export function buildProductJsonLd(product: ProductDetail) {
  const images = product.images
    .map((image) => image.url)
    .filter((url): url is string => Boolean(url))

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.blurb ?? product.desc_long ?? undefined,
    ...(images.length > 0 ? { image: images } : {}),
    sku: product.id,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}${ROUTES.product(product.slug)}`,
      priceCurrency: "INR",
      price: (product.price_paise / 100).toFixed(2),
      availability:
        product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(product.review_count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.review_count,
          },
        }
      : {}),
  }
}

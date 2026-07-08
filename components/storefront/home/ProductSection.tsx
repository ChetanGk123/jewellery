import Link from "next/link"
import { ProductCard } from "@/components/storefront/product/ProductCard"
import type { ProductListItem } from "@/lib/db/queries"

type ProductSectionProps = {
  eyebrow: string
  title: string
  products: ProductListItem[]
  viewAllHref?: string
}

/**
 * A titled product grid used for the home "Bestselling Bridal Pieces" and
 * "New Arrivals" sections. Header carries an eyebrow + serif title, with an
 * optional "View all →" link on the right; the grid renders `ProductCard`s.
 */
export function ProductSection({ eyebrow, title, products, viewAllHref }: ProductSectionProps) {
  if (products.length === 0) return null

  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-3 pt-[58px]">
      <header className="mb-[30px] flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium uppercase leading-none tracking-[0.3em] text-gold-600">
            {eyebrow}
          </span>
          <h2 className="m-0 font-heading text-[38px] font-semibold leading-[1.05] text-maroon-900">
            {title}
          </h2>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="border-b border-gold-400 pb-[3px] text-[12px] font-medium uppercase leading-none tracking-[0.12em] text-maroon-700 transition-colors hover:text-maroon-900"
          >
            View all →
          </Link>
        )}
      </header>

      <div className="grid grid-cols-2 gap-[22px] sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}

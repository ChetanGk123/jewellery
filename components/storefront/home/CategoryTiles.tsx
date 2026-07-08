import Link from "next/link"
import type { CategoryTile } from "@/lib/db/queries"
import { ROUTES } from "@/lib/routes"
import { PLACEHOLDER_GRADIENT } from "@/lib/theme"

/**
 * "Shop by Category" tile grid — matched to the prototype: each category is a
 * tall tile using its `hero_bg` gradient, an engraved motif, the name, and a
 * "{n} styles" count. The whole tile links to the category page.
 */
export function CategoryTiles({ categories }: { categories: CategoryTile[] }) {
  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-3 pt-[62px]">
      <header className="mb-[38px] flex flex-col items-center gap-2 text-center">
        <span className="text-[12px] font-medium uppercase leading-none tracking-[0.3em] text-gold-600">
          Explore
        </span>
        <h2 className="m-0 font-heading text-[40px] font-semibold leading-[1.05] text-maroon-900">
          Shop by Category
        </h2>
      </header>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={ROUTES.category(category.slug)}
            style={{ background: category.hero_bg ?? PLACEHOLDER_GRADIENT }}
            className="group flex aspect-[1/1.12] flex-col items-center justify-center rounded-[3px] border border-[#EFE3D0] px-2.5 text-center transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(74,14,28,0.15)]"
          >
            <svg
              viewBox="0 0 120 120"
              width="58"
              height="58"
              fill="none"
              stroke="#A88A55"
              strokeWidth="1.3"
              className="opacity-60"
              aria-hidden
            >
              <circle cx="60" cy="60" r="40" />
              <path d="M60 30 L65 56 L60 62 L55 56 Z" fill="#A88A55" stroke="none" />
              <path d="M60 90 L65 64 L60 58 L55 64 Z" fill="#A88A55" stroke="none" />
              <circle cx="60" cy="60" r="3" fill="#A88A55" stroke="none" />
            </svg>
            <span className="mt-3.5 font-heading text-[21px] font-semibold leading-[1.1] text-[#3A1A1F]">
              {category.name}
            </span>
            <span className="mt-1.5 text-[11px] font-medium uppercase leading-none tracking-[0.1em] text-gold-600">
              {category.productCount} styles
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

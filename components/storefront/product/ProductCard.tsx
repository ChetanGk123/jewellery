import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "@/lib/db/queries";
import { discountPercent, formatPaise } from "@/lib/utils/money";
import { ROUTES } from "@/lib/routes";
import { PLACEHOLDER_GRADIENT } from "@/lib/theme";

/**
 * Storefront product card, matched to the prototype's `ProductCard` component:
 * square image (real photo, else the seed gradient + engraved motif), corner
 * badge + sale flag, category eyebrow, name, price with struck MRP, rating and
 * an Add button. The whole card links to the product; Add is a stub until the
 * cart store lands in Phase 2.
 */
export function ProductCard({ product }: { product: ProductListItem }) {
  const { slug, name, category, badge, image } = product;
  const off = discountPercent(product.price_paise, product.mrp_paise);
  const hasSale = off > 0;
  const hasBadge = Boolean(badge) && badge !== "None";
  const background = image?.bg ?? PLACEHOLDER_GRADIENT;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[3px] border border-[#EFE3D0] bg-white transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(74,14,28,0.15)]">
      <div
        className="relative flex aspect-square flex-col items-center justify-center"
        style={{ background }}
      >
        {image?.url ? (
          <Image
            src={image.url}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
            className="object-cover"
          />
        ) : (
          <JewelMotif />
        )}

        {hasBadge && (
          <span className="absolute left-3 top-3 rounded-sm bg-maroon-700 px-[9px] py-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.12em] text-cream-200">
            {badge}
          </span>
        )}
        {hasSale && (
          <span className="absolute right-3 top-3 rounded-sm border border-gold-300 bg-white px-[9px] py-1.5 text-[11px] font-semibold leading-none text-gold-600">
            {off}% OFF
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-[7px] px-4 pb-[18px] pt-4">
        <span className="text-[10.5px] font-medium uppercase leading-none tracking-[0.16em] text-gold-600">
          {category.name}
        </span>

        <h3 className="font-heading text-[20px] font-semibold leading-[1.2] text-maroon-900">
          <Link
            href={ROUTES.product(slug)}
            className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
          >
            {name}
          </Link>
        </h3>

        <div className="mt-auto flex items-baseline gap-[9px]">
          <span className="text-[16px] font-semibold leading-none text-maroon-900">
            {formatPaise(product.price_paise)}
          </span>
          {hasSale && product.mrp_paise !== null && (
            <span className="text-[13px] font-normal leading-none text-[#A6938C] line-through">
              {formatPaise(product.mrp_paise)}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="whitespace-nowrap text-[12px] font-medium leading-none text-[#6B5158]">
            <span className="text-gold-400" aria-hidden>
              ★
            </span>{" "}
            {product.rating.toFixed(1)}{" "}
            <span className="text-[#A6938C]">({product.review_count})</span>
          </span>
          <button
            type="button"
            aria-label={`Add ${name} to cart`}
            className="relative z-10 rounded-sm border border-gold-300 bg-[#FBF1E0] px-[13px] py-[9px] text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-gold-600 transition-colors duration-200 hover:border-maroon-700 hover:bg-maroon-700 hover:text-cream-200"
          >
            Add
          </button>
        </div>
      </div>
    </article>
  );
}

/** Engraved sunburst placeholder shown when a product has no real photo. */
function JewelMotif() {
  return (
    <svg
      viewBox="0 0 120 120"
      width="72"
      height="72"
      fill="none"
      stroke="#B58A3C"
      strokeWidth="1.3"
      className="opacity-70"
      aria-hidden
    >
      <circle cx="60" cy="60" r="42" />
      <circle cx="60" cy="60" r="31" className="opacity-50" />
      <path d="M60 26 L65 54 L60 60 L55 54 Z" fill="#B58A3C" stroke="none" />
      <path d="M60 94 L65 66 L60 60 L55 66 Z" fill="#B58A3C" stroke="none" />
      <path d="M26 60 L54 55 L60 60 L54 65 Z" fill="#B58A3C" stroke="none" />
      <path d="M94 60 L66 55 L60 60 L66 65 Z" fill="#B58A3C" stroke="none" />
      <circle cx="60" cy="60" r="3.4" fill="#B58A3C" stroke="none" />
    </svg>
  );
}

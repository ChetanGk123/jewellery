import Link from "next/link"
import type { Review } from "@/lib/db/queries"
import { REVIEWS_PAGE_PARAM } from "@/lib/listing"
import { ReviewForm } from "./ReviewForm"
import { StarRating } from "./StarRating"

/** The section heading's id — also the anchor the Delivered email links to. */
const REVIEWS_ANCHOR = "reviews-heading"

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** Format an ISO timestamp as e.g. "12 Jun 2026"; blank if unparseable. */
function formatReviewDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date)
}

/**
 * Customer reviews section for the product detail page, matched to the
 * storefront prototype: a serif heading over a responsive grid of review cards
 * (stars, title, body, name · date). Shows a gentle empty state when a product
 * has no approved reviews yet.
 */
type Props = {
  reviews: Review[]
  productId: string
  hasPurchased: boolean
  prefillName: string
  /** Page of reviews currently shown (already clamped into range). */
  page: number
  /** Total review pages — 1 hides the pager entirely. */
  pageCount: number
  /** Product page path the pager builds `?reviews=N` links from. */
  baseHref: string
}

export function ProductReviews({
  reviews,
  productId,
  hasPurchased,
  prefillName,
  page,
  pageCount,
  baseHref,
}: Props) {
  return (
    <section aria-labelledby="reviews-heading" className="mt-16 border-t border-[#E7D9C2] pt-10">
      <h2
        id="reviews-heading"
        className="m-0 mb-6 font-heading text-[32px] font-semibold leading-none text-maroon-900"
      >
        Customer Reviews
      </h2>

      {reviews.length > 0 ? (
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="flex flex-col gap-2.5 rounded-[3px] border border-[#EFE3D0] bg-cream-50 p-[22px]"
            >
              <StarRating rating={review.rating} className="text-[14px]" />
              {review.title && (
                <h3 className="font-heading text-[17px] font-semibold leading-[1.3] text-maroon-900">
                  {review.title}
                </h3>
              )}
              {review.body && (
                <p className="m-0 text-[13.5px] font-light leading-[1.6] text-[#5E4A44]">
                  {review.body}
                </p>
              )}
              <p className="m-0 mt-1 text-[12px] font-medium leading-none text-gold-600">
                {review.name}{" "}
                <span className="text-[#7B6B65]">· {formatReviewDate(review.created_at)}</span>
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="m-0 text-[14px] font-light leading-normal text-[#7A655F]">
          No reviews yet — be the first to share your experience.
        </p>
      )}

      {pageCount > 1 && <ReviewPager page={page} pageCount={pageCount} baseHref={baseHref} />}

      <ReviewForm productId={productId} hasPurchased={hasPurchased} prefillName={prefillName} />
    </section>
  )
}

/**
 * Prev/numbered/Next pager for the reviews grid — the storefront listing pager's
 * smaller sibling. Every link carries `#reviews-heading` so following one lands
 * back on the reviews section instead of the top of a long product page.
 */
function ReviewPager({
  page,
  pageCount,
  baseHref,
}: {
  page: number
  pageCount: number
  baseHref: string
}) {
  const hrefFor = (n: number) =>
    n <= 1
      ? `${baseHref}#${REVIEWS_ANCHOR}`
      : `${baseHref}?${REVIEWS_PAGE_PARAM}=${n}#${REVIEWS_ANCHOR}`

  return (
    <nav
      aria-label="Reviews pagination"
      className="mt-7 flex flex-wrap items-center justify-center gap-1.5"
    >
      <ReviewPagerLink href={hrefFor(page - 1)} disabled={page <= 1}>
        ‹ Prev
      </ReviewPagerLink>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={hrefFor(n)}
          aria-current={n === page ? "page" : undefined}
          className={`min-w-[34px] rounded-sm border px-2.5 py-[7px] text-center text-[12px] font-semibold leading-none transition-colors ${
            n === page
              ? "border-maroon-700 bg-maroon-700 text-cream-200"
              : "border-[#E7D9C2] bg-white text-maroon-700 hover:border-gold-400"
          }`}
        >
          {n}
        </Link>
      ))}
      <ReviewPagerLink href={hrefFor(page + 1)} disabled={page >= pageCount}>
        Next ›
      </ReviewPagerLink>
    </nav>
  )
}

function ReviewPagerLink({
  href,
  disabled,
  children,
}: {
  href: string
  disabled: boolean
  children: React.ReactNode
}) {
  const className =
    "rounded-sm border border-[#E7D9C2] bg-white px-3 py-[7px] text-[12px] font-medium leading-none text-maroon-700 transition-colors hover:border-gold-400"
  if (disabled) {
    return <span className={`${className} cursor-not-allowed opacity-40`}>{children}</span>
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

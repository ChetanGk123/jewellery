import type { Review } from "@/lib/db/queries";
import { StarRating } from "./StarRating";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Format an ISO timestamp as e.g. "12 Jun 2026"; blank if unparseable. */
function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
}

/**
 * Customer reviews section for the product detail page, matched to the
 * storefront prototype: a serif heading over a responsive grid of review cards
 * (stars, title, body, name · date). Shows a gentle empty state when a product
 * has no approved reviews yet.
 */
export function ProductReviews({ reviews }: { reviews: Review[] }) {
  return (
    <section
      aria-labelledby="reviews-heading"
      className="mt-16 border-t border-[#E7D9C2] pt-10"
    >
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
                <span className="text-[#9C8A84]">
                  · {formatReviewDate(review.created_at)}
                </span>
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="m-0 text-[14px] font-light leading-normal text-[#7A655F]">
          No reviews yet — be the first to share your experience.
        </p>
      )}
    </section>
  );
}

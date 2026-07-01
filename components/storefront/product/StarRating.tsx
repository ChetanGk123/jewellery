/**
 * Gold five-star rating, rounded to the nearest whole star. Decorative glyphs
 * are hidden from assistive tech; the numeric value is announced via the label
 * on the wrapper. Server-safe (no client state) so it renders in both the detail
 * header and the review cards.
 */
export function StarRating({
  rating,
  className,
}: {
  rating: number;
  className?: string;
}) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
      className={className}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={i < filled ? "text-gold-400" : "text-[#E0CFB4]"}
        >
          ★
        </span>
      ))}
    </span>
  );
}

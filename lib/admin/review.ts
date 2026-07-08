/**
 * Client-safe review types + list-cell helpers for the admin console (TASKS
 * 3.7). Kept free of `server-only` imports so the client ReviewsView and the
 * server data module (`lib/db/admin-reviews.ts`) can share them without dragging
 * the Supabase server client into the browser bundle. Mirrors the split used by
 * `lib/admin/coupon.ts` / `lib/admin/order-status.ts`.
 */

/** A review's moderation status (matches the `review_status_check` constraint). */
export type ReviewStatus = "pending" | "approved" | "rejected"

/** The moderation tabs. `All` includes rejected reviews (the only place they show). */
export type ReviewFilter = "Pending" | "Approved" | "All"

export const REVIEW_FILTERS: ReviewFilter[] = ["Pending", "Approved", "All"]

/** Reviews shown per page in the admin moderation grid (TASKS 5.10). */
export const ADMIN_REVIEWS_PAGE_SIZE = 12

/**
 * Coerce an untrusted `?status=` value to a valid filter. Defaults to `Pending`
 * (no param → the moderation queue, matching where the view used to land).
 */
export function toReviewFilter(value: string | undefined): ReviewFilter {
  return value && (REVIEW_FILTERS as string[]).includes(value) ? (value as ReviewFilter) : "Pending"
}

/** Per-tab counts for the filter pills (mirrors the orders `counts[tab]` shape). */
export type ReviewCounts = Record<ReviewFilter, number>

/** A `review` row as the admin console needs it — product name resolved, camelCase. */
export type AdminReviewRow = {
  id: string
  /** The reviewed product's display name (or a fallback if it was removed). */
  productName: string
  /** The reviewer's name. */
  author: string
  rating: number
  title: string | null
  body: string | null
  status: ReviewStatus
  /** ISO instant the review was submitted. */
  createdAt: string
}

type StatusChip = { label: string; color: string; bg: string }

const CHIPS: Record<ReviewStatus, StatusChip> = {
  pending: { label: "Pending", color: "#B7791F", bg: "#FBF1DD" },
  approved: { label: "Approved", color: "#15692F", bg: "#E7F3EB" },
  rejected: { label: "Rejected", color: "#C0392F", bg: "#FBE9E7" },
}

/** Status pill metadata for a review card — amber / green / red. */
export function reviewStatusChip(status: ReviewStatus): StatusChip {
  return CHIPS[status]
}

const MAX_STARS = 5

/** "★★★★☆" for a 1–5 rating (clamped), matching the prototype's star string. */
export function reviewStars(rating: number): string {
  const filled = Math.max(0, Math.min(MAX_STARS, Math.round(rating)))
  return "★".repeat(filled) + "☆".repeat(MAX_STARS - filled)
}

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** "12 Jun 2026", or "" if the timestamp can't be parsed. */
export function reviewDateLabel(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : DATE_FMT.format(date)
}

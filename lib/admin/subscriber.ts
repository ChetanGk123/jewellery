/**
 * Client-safe subscriber types + list-cell helpers for the admin console
 * (TASKS 3.9). Free of `server-only` imports so the client `SubscribersView`
 * and the server data module (`lib/db/admin-subscribers.ts`) can share them.
 * Mirrors the split used by `lib/admin/review.ts` / `lib/admin/message.ts`.
 */

/** Where a subscriber signed up. Only `footer` exists in v1 (checkout/popup deferred). */
export type SubscriberSource = "footer" | "checkout" | "popup";

/** A `subscriber` row as the admin console needs it, camelCase. */
export type AdminSubscriberRow = {
  id: string;
  email: string;
  source: SubscriberSource;
  /** ISO instant the address joined the list. */
  createdAt: string;
};

/** One KPI card at the top of the view. */
export type SubscriberKpi = {
  label: string;
  value: string;
  /** Accent colour for the value, matching the prototype's per-card accents. */
  accent: string;
};

type SourceChip = { label: string; color: string; bg: string };

const SOURCE_CHIPS: Record<SubscriberSource, SourceChip> = {
  footer: { label: "Footer", color: "#71182B", bg: "#FBF1DD" },
  checkout: { label: "Checkout", color: "#1B6FA8", bg: "#E4F0F8" },
  popup: { label: "Popup", color: "#15692F", bg: "#E7F3EB" },
};

/** Source pill metadata for a mailing-list row. */
export function subscriberSourceChip(source: SubscriberSource): SourceChip {
  return SOURCE_CHIPS[source] ?? SOURCE_CHIPS.footer;
}

/** The avatar glyph — first letter of the address, uppercased ("a@b.com" → "A"). */
export function subscriberInitial(email: string): string {
  const first = email.trim().charAt(0).toUpperCase();
  return first || "?";
}

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "12 Jun 2026", or "" if the timestamp can't be parsed. */
export function subscriberDateLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : DATE_FMT.format(date);
}

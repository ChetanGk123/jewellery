/**
 * Client-safe contact-message types + list-cell helpers for the admin console
 * (TASKS 3.8). Free of `server-only` imports so the client MessagesView and the
 * server data module (`lib/db/admin-messages.ts`) can share them. Mirrors the
 * split used by `lib/admin/review.ts` / `lib/admin/coupon.ts`.
 */

/** A ticket's status (matches the `contact_message` status check). */
export type MessageStatus = "New" | "In Progress" | "Resolved";

/** The moderation tabs — All plus each status. */
export type MessageFilter = "All" | MessageStatus;

export const MESSAGE_FILTERS: MessageFilter[] = [
  "All",
  "New",
  "In Progress",
  "Resolved",
];

/** The real ticket statuses (the tabs minus the catch-all "All"). */
export const MESSAGE_STATUSES: MessageStatus[] = [
  "New",
  "In Progress",
  "Resolved",
];

/** Messages shown per page in the admin queue (TASKS 5.10). */
export const ADMIN_MESSAGES_PAGE_SIZE = 12;

/**
 * Coerce an untrusted `?status=` value to a valid filter. Defaults to `New`
 * (no param → the fresh-enquiry queue, matching where the view used to land).
 */
export function toMessageFilter(value: string | undefined): MessageFilter {
  return value && (MESSAGE_FILTERS as string[]).includes(value)
    ? (value as MessageFilter)
    : "New";
}

/** Per-tab counts for the filter pills. */
export type MessageCounts = Record<MessageFilter, number>;

/** A `contact_message` row as the admin console needs it, camelCase. */
export type AdminMessageRow = {
  id: string;
  ticketNo: string;
  subject: string | null;
  body: string;
  name: string;
  /** Customer email — the admin can reach them here or by phone. */
  email: string;
  /** Customer phone (10-digit mobile). */
  phone: string;
  status: MessageStatus;
  /** ISO instant the ticket was raised. */
  createdAt: string;
};

type StatusChip = { label: string; color: string; bg: string };

const CHIPS: Record<MessageStatus, StatusChip> = {
  New: { label: "New", color: "#B7791F", bg: "#FBF1DD" },
  "In Progress": { label: "In Progress", color: "#1B6FA8", bg: "#E4F0F8" },
  Resolved: { label: "Resolved", color: "#15692F", bg: "#E7F3EB" },
};

/** Status pill metadata for a ticket card — amber / blue / green. */
export function messageStatusChip(status: MessageStatus): StatusChip {
  return CHIPS[status];
}

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "12 Jun 2026", or "" if the timestamp can't be parsed. */
export function messageDateLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : DATE_FMT.format(date);
}

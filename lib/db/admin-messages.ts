import "server-only";
import {
  ADMIN_MESSAGES_PAGE_SIZE,
  type AdminMessageRow,
  type MessageCounts,
  type MessageFilter,
  MESSAGE_STATUSES,
  type MessageStatus,
} from "@/lib/admin/message";
import { type AdminRead, loadAdmin } from "./admin-read";
import { createServerClient } from "./server";

export type AdminMessagesPage = {
  rows: AdminMessageRow[];
  counts: MessageCounts;
  filter: MessageFilter;
  page: number;
  pageCount: number;
  total: number;
};

const EMPTY_COUNTS: MessageCounts = {
  All: 0,
  New: 0,
  "In Progress": 0,
  Resolved: 0,
};

function emptyPage(filter: MessageFilter, page: number): AdminMessagesPage {
  return {
    rows: [],
    counts: EMPTY_COUNTS,
    filter,
    page,
    pageCount: 1,
    total: 0,
  };
}

/**
 * Admin contact messages (TASKS 3.8, paginated in 5.10). Reads one page of
 * `contact_message` rows through the admin's cookie session (0015
 * `contact_message_admin_read` RLS policy), newest first. The status-tab counts
 * come from exact head-counts per status (scale-safe as the table grows
 * monotonically). Writes go through the `admin_set_message_status` RPC (0015).
 */
export async function listAdminMessages(opts: {
  filter: MessageFilter;
  page: number;
}): Promise<AdminRead<AdminMessagesPage>> {
  const filter = opts.filter;
  const page = Math.max(1, opts.page);

  return loadAdmin(
    "messages",
    async () => {
      const supabase = await createServerClient();
      const from = (page - 1) * ADMIN_MESSAGES_PAGE_SIZE;

      let rowsQuery = supabase
        .from("contact_message")
        .select(
          "id, ticket_no, subject, body, name, email, phone, status, created_at",
        )
        .order("created_at", { ascending: false })
        .range(from, from + ADMIN_MESSAGES_PAGE_SIZE - 1);
      if (filter !== "All") rowsQuery = rowsQuery.eq("status", filter);

      const [rowsRes, ...countRes] = await Promise.all([
        rowsQuery,
        ...MESSAGE_STATUSES.map((s) =>
          supabase
            .from("contact_message")
            .select("*", { count: "exact", head: true })
            .eq("status", s),
        ),
      ]);

      const counts: MessageCounts = { ...EMPTY_COUNTS };
      let all = 0;
      MESSAGE_STATUSES.forEach((s, i) => {
        const c = countRes[i].count ?? 0;
        counts[s] = c;
        all += c;
      });
      counts.All = all;

      const rows: AdminMessageRow[] = (rowsRes.data ?? []).map((m) => ({
        id: m.id,
        ticketNo: m.ticket_no,
        subject: m.subject,
        body: m.body,
        name: m.name,
        email: m.email,
        phone: m.phone,
        status: m.status as MessageStatus,
        createdAt: m.created_at,
      }));

      const total = counts[filter];
      const pageCount = Math.max(
        1,
        Math.ceil(total / ADMIN_MESSAGES_PAGE_SIZE),
      );

      return { rows, counts, filter, page, pageCount, total };
    },
    emptyPage(filter, page),
  );
}

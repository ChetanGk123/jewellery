import "server-only";
import type {
  AdminMessageRow,
  MessageCounts,
  MessageStatus,
} from "@/lib/admin/message";
import { createServerClient } from "./server";

export type AdminMessagesData = {
  rows: AdminMessageRow[];
  counts: MessageCounts;
};

const EMPTY: AdminMessagesData = {
  rows: [],
  counts: { All: 0, New: 0, "In Progress": 0, Resolved: 0 },
};

/**
 * Admin contact messages (TASKS 3.8). Reads every `contact_message` row through
 * the admin's cookie session (0015 `contact_message_admin_read` RLS policy),
 * newest first, and derives the per-status tab counts. Writes go through the
 * `admin_set_message_status` RPC (0015). Degrades to empty on error so the
 * console chrome still renders.
 */
export async function listAdminMessages(): Promise<AdminMessagesData> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("contact_message")
      .select("id, ticket_no, subject, body, name, contact, status, created_at")
      .order("created_at", { ascending: false });

    const rows: AdminMessageRow[] = (data ?? []).map((m) => ({
      id: m.id,
      ticketNo: m.ticket_no,
      subject: m.subject,
      body: m.body,
      name: m.name,
      contact: m.contact,
      status: m.status as MessageStatus,
      createdAt: m.created_at,
    }));

    const counts: MessageCounts = {
      All: rows.length,
      New: rows.filter((r) => r.status === "New").length,
      "In Progress": rows.filter((r) => r.status === "In Progress").length,
      Resolved: rows.filter((r) => r.status === "Resolved").length,
    };

    return { rows, counts };
  } catch {
    return EMPTY;
  }
}

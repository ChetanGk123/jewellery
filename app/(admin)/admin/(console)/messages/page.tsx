import type { Metadata } from "next";
import { MessagesView } from "@/components/admin/messages/MessagesView";
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminMessages } from "@/lib/db/admin-messages";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminMessages].title,
};

/**
 * Contact messages page (TASKS 3.8). Reads every ticket (admin RLS) plus the
 * per-status counts server-side and hands them to the client `MessagesView`,
 * which owns the tab filter and the Start / Resolve / Reopen transitions.
 */
export default async function AdminMessagesPage() {
  const {
    data: { rows, counts },
    error,
  } = await listAdminMessages();
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <MessagesView messages={rows} counts={counts} />
    </div>
  );
}

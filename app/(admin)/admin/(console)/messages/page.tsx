import type { Metadata } from "next";
import { MessagesView } from "@/components/admin/messages/MessagesView";
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner";
import { toMessageFilter } from "@/lib/admin/message";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminMessages } from "@/lib/db/admin-messages";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminMessages].title,
};

/**
 * Contact messages page (TASKS 3.8, paginated 5.10). Reads one page of tickets
 * (admin RLS) plus the per-status head-counts server-side, driven by URL params
 * (`?status`/`?page`), and hands the page to the client `MessagesView`, which
 * owns the Start / Resolve / Reopen transitions.
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const { data, error } = await listAdminMessages({
    filter: toMessageFilter(sp.status),
    page: Math.max(1, Number(sp.page) || 1),
  });
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <MessagesView page={data} />
    </div>
  );
}

import type { Metadata } from "next";
import { ReviewsView } from "@/components/admin/reviews/ReviewsView";
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminReviews } from "@/lib/db/admin-reviews";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminReviews].title,
};

/**
 * Reviews moderation page (TASKS 3.7). Reads every review (admin RLS) plus the
 * per-status counts server-side and hands them to the client `ReviewsView`,
 * which owns the tab filter and the approve/reject actions.
 */
export default async function AdminReviewsPage() {
  const {
    data: { rows, counts },
    error,
  } = await listAdminReviews();
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <ReviewsView reviews={rows} counts={counts} />
    </div>
  );
}

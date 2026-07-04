import type { Metadata } from "next";
import { ReviewsView } from "@/components/admin/reviews/ReviewsView";
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
  const { rows, counts } = await listAdminReviews();
  return <ReviewsView reviews={rows} counts={counts} />;
}

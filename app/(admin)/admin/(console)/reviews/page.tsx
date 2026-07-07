import type { Metadata } from "next";
import { ReviewsView } from "@/components/admin/reviews/ReviewsView";
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner";
import { toReviewFilter } from "@/lib/admin/review";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminReviews } from "@/lib/db/admin-reviews";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminReviews].title,
};

/**
 * Reviews moderation page (TASKS 3.7, paginated 5.10). Reads one page of reviews
 * (admin RLS) plus the per-status head-counts server-side, driven by URL params
 * (`?status`/`?page`), and hands the page to the client `ReviewsView`, which owns
 * the approve/reject actions.
 */
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const { data, error } = await listAdminReviews({
    filter: toReviewFilter(sp.status),
    page: Math.max(1, Number(sp.page) || 1),
  });
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <ReviewsView page={data} />
    </div>
  );
}

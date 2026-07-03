import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/ui/AdminPlaceholder";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminReviews].title,
};

export default function AdminReviewsPage() {
  return (
    <AdminPlaceholder
      title="Reviews"
      phase="3.7"
      description="Moderate customer reviews — approve or reject pending submissions across Pending / Approved / All tabs. The storefront shows approved reviews only."
    />
  );
}

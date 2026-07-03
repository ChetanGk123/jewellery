import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/ui/AdminPlaceholder";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminCoupons].title,
};

export default function AdminCouponsPage() {
  return (
    <AdminPlaceholder
      title="Coupons & Offers"
      phase="3.6"
      description="The coupon table that replaces the hardcoded BRIDE20 rule — percentage, flat and free-shipping codes with min-order, usage limits and expiry, enforced at checkout."
    />
  );
}

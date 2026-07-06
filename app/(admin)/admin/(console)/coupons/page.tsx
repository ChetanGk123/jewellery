import type { Metadata } from "next";
import { CouponsView } from "@/components/admin/coupons/CouponsView";
import { AdminErrorBanner } from "@/components/admin/ui/AdminErrorBanner";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminCoupons } from "@/lib/db/admin-coupons";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminCoupons].title,
};

export default async function AdminCouponsPage() {
  const { data: coupons, error } = await listAdminCoupons();
  return (
    <div className="flex flex-col gap-6">
      {error && <AdminErrorBanner />}
      <CouponsView coupons={coupons} />
    </div>
  );
}

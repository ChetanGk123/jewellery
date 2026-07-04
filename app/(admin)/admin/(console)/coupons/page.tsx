import type { Metadata } from "next";
import { CouponsView } from "@/components/admin/coupons/CouponsView";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { listAdminCoupons } from "@/lib/db/admin-coupons";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminCoupons].title,
};

export default async function AdminCouponsPage() {
  const coupons = await listAdminCoupons();
  return <CouponsView coupons={coupons} />;
}

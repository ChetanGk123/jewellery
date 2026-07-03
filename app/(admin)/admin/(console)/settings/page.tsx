import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/ui/AdminPlaceholder";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminSettings].title,
};

export default function AdminSettingsPage() {
  return (
    <AdminPlaceholder
      title="Settings"
      phase="3.11"
      description="Store information, shipping and payment thresholds (the source of truth the storefront reads), plus the announcement banner and homepage promo editors."
    />
  );
}

import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/ui/AdminPlaceholder";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminSubscribers].title,
};

export default function AdminSubscribersPage() {
  return (
    <AdminPlaceholder
      title="Subscribers"
      phase="3.9"
      description="Your newsletter audience from the footer sign-up — with source, export and growth stats — once that form is wired to save subscribers."
    />
  );
}

import type { Metadata } from "next";
import { AdminPlaceholder } from "@/components/admin/ui/AdminPlaceholder";
import { ADMIN_PAGE_META } from "@/lib/admin/nav";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminMessages].title,
};

export default function AdminMessagesPage() {
  return (
    <AdminPlaceholder
      title="Messages"
      phase="3.8"
      description="Contact-form enquiries as a lightweight ticket queue — New / In Progress / Resolved — once the storefront contact form is wired to actually submit."
    />
  );
}

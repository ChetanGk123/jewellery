import type { Metadata } from "next";
import { AdminAuthShell } from "@/components/admin/auth/AdminAuthShell";
import { AdminResetPasswordForm } from "@/components/admin/auth/AdminResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default function AdminResetPasswordPage() {
  return (
    <AdminAuthShell
      title="Choose a new password"
      subtitle="Set a new password for your admin account."
    >
      <AdminResetPasswordForm />
    </AdminAuthShell>
  );
}

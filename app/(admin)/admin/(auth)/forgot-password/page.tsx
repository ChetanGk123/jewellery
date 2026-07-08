import type { Metadata } from "next"
import { AdminAuthShell } from "@/components/admin/auth/AdminAuthShell"
import { AdminForgotPasswordForm } from "@/components/admin/auth/AdminForgotPasswordForm"

export const metadata: Metadata = { title: "Reset password" }

export default function AdminForgotPasswordPage() {
  return (
    <AdminAuthShell
      title="Reset password"
      subtitle="Enter your admin email and we'll send a link to choose a new password."
    >
      <AdminForgotPasswordForm />
    </AdminAuthShell>
  )
}

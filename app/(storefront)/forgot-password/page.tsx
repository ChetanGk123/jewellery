import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthCard } from "@/components/storefront/auth/AuthCard"
import { ForgotPasswordForm } from "@/components/storefront/auth/ForgotPasswordForm"
import { getCurrentUser } from "@/lib/db/server"
import { ROUTES } from "@/lib/routes"

export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false },
}

/** Request a password-reset email. Signed-in users go to their account. */
export default async function ForgotPasswordPage() {
  const user = await getCurrentUser()
  if (user) redirect(ROUTES.account)

  return (
    <AuthCard
      title="Reset password"
      subtitle="Enter your email and we'll send you a link to choose a new password."
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}

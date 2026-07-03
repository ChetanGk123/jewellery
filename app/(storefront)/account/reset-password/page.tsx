import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/storefront/auth/AuthCard";
import { ResetPasswordForm } from "@/components/storefront/auth/ResetPasswordForm";
import { getCurrentUser } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Choose a New Password",
  robots: { index: false },
};

/**
 * Final step of the reset flow. The email link lands on `/auth/callback`,
 * which establishes the recovery session and forwards here; without a session
 * (expired/direct visit) we bounce to sign-in.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.resetPassword)}`,
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle={`Signed in as ${user.email ?? "your account"} — set the new password below.`}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}

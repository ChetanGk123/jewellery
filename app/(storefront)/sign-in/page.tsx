import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard, AuthError, AuthLink } from "@/components/storefront/auth/AuthCard";
import { SignInForm } from "@/components/storefront/auth/SignInForm";
import { safeNext } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false },
};

type Search = Promise<{ next?: string; error?: string }>;

/** Sign-in screen. Already signed in? Straight through to the target. */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { next, error } = await searchParams;
  const target = safeNext(next);

  const user = await getCurrentUser();
  if (user) redirect(target);

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to check out, view your orders and manage your details."
      footer={
        <>
          New to JR Jewellers?{" "}
          <AuthLink
            href={`${ROUTES.signUp}?next=${encodeURIComponent(target)}`}
          >
            Create an account
          </AuthLink>
        </>
      }
    >
      {error && (
        <AuthError
          message={
            error === "expired"
              ? "That sign-in link has expired. Please request a new one below."
              : "That link has expired or was already used. Please sign in or request a new one."
          }
        />
      )}
      <SignInForm next={target} />
    </AuthCard>
  );
}

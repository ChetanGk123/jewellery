import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminAuthShell } from "@/components/admin/auth/AdminAuthShell";
import { AdminSignInForm } from "@/components/admin/auth/AdminSignInForm";
import { AuthError } from "@/components/storefront/auth/AuthCard";
import { isAdmin } from "@/lib/admin/roles";
import { safeNext } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/db/server";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in" };

type Search = Promise<{ next?: string; error?: string }>;

/** Admin sign-in. Already an admin? Straight through to the console. */
export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { next, error } = await searchParams;
  const safe = safeNext(next, ROUTES.admin);
  const target = safe.startsWith("/admin") ? safe : ROUTES.admin;

  const user = await getCurrentUser();
  if (isAdmin(user)) redirect(target);

  return (
    <AdminAuthShell
      title="Welcome back"
      subtitle="Sign in to the RJ Jewellers admin console."
    >
      {error && (
        <AuthError
          message={
            error === "expired"
              ? "That link has expired. Please sign in again."
              : "That link has expired or was already used. Please sign in."
          }
        />
      )}
      <AdminSignInForm next={target} />
    </AdminAuthShell>
  );
}

import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthCard, AuthLink } from "@/components/storefront/auth/AuthCard"
import { SignUpForm } from "@/components/storefront/auth/SignUpForm"
import { safeNext } from "@/lib/auth/redirect"
import { getCurrentUser } from "@/lib/db/server"
import { ROUTES } from "@/lib/routes"

export const metadata: Metadata = {
  title: "Create Account",
  robots: { index: false },
}

type Search = Promise<{ next?: string }>

/** Create-account screen. Already signed in? Straight through to the target. */
export default async function SignUpPage({ searchParams }: { searchParams: Search }) {
  const { next } = await searchParams
  const target = safeNext(next)

  const user = await getCurrentUser()
  if (user) redirect(target)

  return (
    <AuthCard
      title="Create your account"
      subtitle="Track orders, save your details and check out faster."
      footer={
        <>
          Already have an account?{" "}
          <AuthLink href={`${ROUTES.signIn}?next=${encodeURIComponent(target)}`}>Sign in</AuthLink>
        </>
      }
    >
      <SignUpForm next={target} />
    </AuthCard>
  )
}

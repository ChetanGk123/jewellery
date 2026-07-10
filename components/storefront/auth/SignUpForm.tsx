"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { safeNext } from "@/lib/auth/redirect"
import { signUpSchema, type SignUpValues } from "@/lib/auth/schema"
import { supabase } from "@/lib/db/client"
import { ROUTES } from "@/lib/routes"
import { AuthError, AuthField, AuthSubmit } from "./AuthCard"
import { GoogleButton } from "./GoogleButton"

/**
 * Create-account card body. Email confirmation is ON (Supabase default), so a
 * successful sign-up lands on the "check your email" state; the confirm link
 * returns through `/auth/callback` and continues to `next`. The full name is
 * stored in auth user metadata now and copied into `customer_profile` on
 * first checkout/profile save.
 */
export function SignUpForm({ next }: { next: string }) {
  const target = safeNext(next)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) })

  const onValid = async (values: SignUpValues) => {
    setFormError(null)
    const emailRedirectTo = `${window.location.origin}${ROUTES.authCallback}?next=${encodeURIComponent(target)}`
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo,
        data: { full_name: values.fullName },
      },
    })
    if (error) {
      setFormError(
        error.message.includes("already registered")
          ? "An account with this email already exists — try signing in."
          : "We couldn't create your account just now. Please try again.",
      )
      return
    }
    // Confirmation off (or auto-confirmed): a session exists — go straight in.
    if (data.session) {
      window.location.assign(target)
      return
    }
    setSentTo(values.email)
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[14px] leading-relaxed text-[#5E4A44]">
          We&apos;ve sent a confirmation link to{" "}
          <span className="font-medium text-maroon-900">{sentTo}</span>. Click it to activate your
          account — this page can be closed.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit(onValid)} noValidate className="flex flex-col gap-4">
        <AuthField
          id="fullName"
          label="Full name"
          autoComplete="name"
          error={errors.fullName?.message}
          registration={register("fullName")}
        />
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          registration={register("email")}
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          registration={register("password")}
        />
        <AuthError message={formError} />
        <AuthSubmit isBusy={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create Account"}
        </AuthSubmit>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[#EFE3D0]" />
        <span className="text-[11px] uppercase tracking-[0.14em] text-[#7B6B65]">or</span>
        <span className="h-px flex-1 bg-[#EFE3D0]" />
      </div>

      <GoogleButton next={target} />
    </div>
  )
}

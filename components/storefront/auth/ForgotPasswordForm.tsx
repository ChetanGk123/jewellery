"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/auth/schema"
import { supabase } from "@/lib/db/client"
import { ROUTES } from "@/lib/routes"
import { AuthError, AuthField, AuthLink, AuthSubmit } from "./AuthCard"

/**
 * Request a password-reset email. The link returns through `/auth/callback`
 * (code → session) and continues to the reset-password screen. Always lands on
 * the "check your email" state on success — and also when the email is
 * unknown, so the form can't be used to probe which emails have accounts.
 */
export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onValid = async ({ email }: ForgotPasswordValues) => {
    setFormError(null)
    const redirectTo = `${window.location.origin}${ROUTES.authCallback}?next=${encodeURIComponent(ROUTES.resetPassword)}`
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })
    if (error) {
      setFormError("We couldn't send the email just now. Please try again.")
      return
    }
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <p className="m-0 text-[14px] leading-relaxed text-[#5E4A44]">
        If an account exists for <span className="font-medium text-maroon-900">{sentTo}</span>,
        you&apos;ll receive a reset link shortly. The link opens a page where you can choose a new
        password.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="flex flex-col gap-4">
      <AuthField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        registration={register("email")}
      />
      <AuthError message={formError} />
      <AuthSubmit isBusy={isSubmitting}>{isSubmitting ? "Sending…" : "Send Reset Link"}</AuthSubmit>
      <AuthLink href={ROUTES.signIn}>Back to sign in</AuthLink>
    </form>
  )
}

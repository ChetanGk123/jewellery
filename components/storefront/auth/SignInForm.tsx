"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { safeNext } from "@/lib/auth/redirect"
import {
  otpRequestSchema,
  type OtpRequestValues,
  otpVerifySchema,
  type OtpVerifyValues,
  signInSchema,
  type SignInValues,
} from "@/lib/auth/schema"
import { supabase } from "@/lib/db/client"
import { ROUTES } from "@/lib/routes"
import { AuthError, AuthField, AuthLink, AuthSubmit } from "./AuthCard"
import { GoogleButton } from "./GoogleButton"

type Mode = "password" | "otp"

/**
 * Sign-in card body: email+password by default, a passwordless mode behind the
 * "Email me a sign-in link instead" toggle, and Google OAuth below the divider.
 * On success we do a full navigation to `next` so the server layout re-renders
 * with the new session cookie (header flips to "Account").
 */
export function SignInForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("password")
  const target = safeNext(next)

  return (
    <div className="flex flex-col gap-5">
      {mode === "password" ? <PasswordForm target={target} /> : <OtpForm target={target} />}

      <button
        type="button"
        onClick={() => setMode(mode === "password" ? "otp" : "password")}
        className="self-start border-none bg-transparent p-0 text-[13px] font-medium text-maroon-700 underline-offset-4 hover:underline"
      >
        {mode === "password" ? "Email me a sign-in link instead" : "Use a password instead"}
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[#EFE3D0]" />
        <span className="text-[11px] uppercase tracking-[0.14em] text-[#9C8A84]">or</span>
        <span className="h-px flex-1 bg-[#EFE3D0]" />
      </div>

      <GoogleButton next={target} />
    </div>
  )
}

function PasswordForm({ target }: { target: string }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) })

  const onValid = async (values: SignInValues) => {
    setFormError(null)
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      setFormError(
        error.message === "Invalid login credentials"
          ? "That email and password don't match. Please try again."
          : "We couldn't sign you in just now. Please try again.",
      )
      return
    }
    window.location.assign(target)
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
      <AuthField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        registration={register("password")}
      />
      <AuthError message={formError} />
      <AuthSubmit isBusy={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign In"}</AuthSubmit>
      <AuthLink href={ROUTES.forgotPassword}>Forgot your password?</AuthLink>
    </form>
  )
}

/**
 * Passwordless flow. Requesting sends ONE email whose content depends on the
 * project's "Magic Link" template: a sign-in link (handled by /auth/callback)
 * and — when the template includes `{{ .Token }}` — a one-time code (6–10
 * digits, per the project's Email OTP Length setting) that can be entered
 * here. The sent-state supports both so the UI never promises something the
 * email doesn't contain.
 */
function OtpForm({ target }: { target: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const request = useForm<OtpRequestValues>({
    resolver: zodResolver(otpRequestSchema),
  })
  const verify = useForm<OtpVerifyValues>({
    resolver: zodResolver(otpVerifySchema),
  })

  const onRequest = async ({ email }: OtpRequestValues) => {
    setFormError(null)
    // The emailed link returns through /auth/callback: either as
    // ?token_hash=…&type=… (recommended template — verified server-side) or
    // as a same-browser PKCE ?code=… (default template). Both are handled.
    const emailRedirectTo = `${window.location.origin}${ROUTES.authCallback}?next=${encodeURIComponent(target)}`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    })
    if (error) {
      setFormError("We couldn't send the email just now. Please try again.")
      return
    }
    verify.setValue("email", email)
    setSentTo(email)
  }

  const onVerify = async ({ email, code }: OtpVerifyValues) => {
    setFormError(null)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    })
    if (error) {
      setFormError("That code didn't match or has expired. Please try again.")
      return
    }
    window.location.assign(target)
  }

  if (sentTo) {
    return (
      <form onSubmit={verify.handleSubmit(onVerify)} noValidate className="flex flex-col gap-4">
        <p className="m-0 text-[13.5px] leading-relaxed text-[#5E4A44]">
          We&apos;ve emailed <span className="font-medium text-maroon-900">{sentTo}</span>. Open the{" "}
          <span className="font-medium text-maroon-900">sign-in link</span> in that email to
          continue — or, if it shows a one-time code, enter it below.
        </p>
        <AuthField
          id="code"
          label="One-time code (if your email has one)"
          inputMode="numeric"
          autoComplete="one-time-code"
          error={verify.formState.errors.code?.message}
          registration={verify.register("code")}
        />
        <AuthError message={formError} />
        <AuthSubmit isBusy={verify.formState.isSubmitting}>
          {verify.formState.isSubmitting ? "Verifying…" : "Verify & Sign In"}
        </AuthSubmit>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="self-start border-none bg-transparent p-0 text-[13px] font-medium text-maroon-700 underline-offset-4 hover:underline"
        >
          Use a different email
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={request.handleSubmit(onRequest)} noValidate className="flex flex-col gap-4">
      <AuthField
        id="otp-email"
        label="Email"
        type="email"
        autoComplete="email"
        error={request.formState.errors.email?.message}
        registration={request.register("email")}
      />
      <AuthError message={formError} />
      <AuthSubmit isBusy={request.formState.isSubmitting}>
        {request.formState.isSubmitting ? "Sending…" : "Email me a sign-in link"}
      </AuthSubmit>
    </form>
  )
}

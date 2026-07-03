"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  AuthError,
  AuthField,
  AuthLink,
  AuthSubmit,
} from "@/components/storefront/auth/AuthCard";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/lib/auth/schema";
import { supabase } from "@/lib/db/client";
import { ROUTES } from "@/lib/routes";

/**
 * Request an admin password-reset email. The link returns through
 * `/auth/callback` (which routes recovery to the admin reset page via `next`)
 * and continues to choose a new password. Always shows the "check your email"
 * state on success — and on an unknown email too, so it can't probe accounts.
 */
export function AdminForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onValid = async ({ email }: ForgotPasswordValues) => {
    setFormError(null);
    const redirectTo = `${window.location.origin}${ROUTES.authCallback}?next=${encodeURIComponent(ROUTES.adminResetPassword)}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      setFormError("We couldn't send the email just now. Please try again.");
      return;
    }
    setSentTo(email);
  };

  if (sentTo) {
    return (
      <p className="m-0 text-[14px] leading-relaxed text-[#5E4A44]">
        If an admin account exists for{" "}
        <span className="font-medium text-maroon-900">{sentTo}</span>,
        you&apos;ll receive a reset link shortly. The link opens a page where you
        can choose a new password.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      noValidate
      className="flex flex-col gap-4"
    >
      <AuthField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        registration={register("email")}
      />
      <AuthError message={formError} />
      <AuthSubmit isBusy={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send Reset Link"}
      </AuthSubmit>
      <AuthLink href={ROUTES.adminSignIn}>Back to sign in</AuthLink>
    </form>
  );
}

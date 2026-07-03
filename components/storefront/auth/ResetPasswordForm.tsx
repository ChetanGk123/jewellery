"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/lib/auth/schema";
import { supabase } from "@/lib/db/client";
import { ROUTES } from "@/lib/routes";
import { AuthError, AuthField, AuthSubmit } from "./AuthCard";

/**
 * Choose a new password. The user arrives here from the reset-link email —
 * `/auth/callback` has already exchanged the recovery code for a session, so
 * `updateUser` is authorised. On success, straight to the account page.
 */
export function ResetPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onValid = async ({ password }: ResetPasswordValues) => {
    setFormError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError(
        error.message.includes("different from the old")
          ? "Your new password must be different from the old one."
          : "We couldn't update your password just now. Please try again.",
      );
      return;
    }
    window.location.assign(ROUTES.account);
  };

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      noValidate
      className="flex flex-col gap-4"
    >
      <AuthField
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        registration={register("password")}
      />
      <AuthError message={formError} />
      <AuthSubmit isBusy={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save New Password"}
      </AuthSubmit>
    </form>
  );
}

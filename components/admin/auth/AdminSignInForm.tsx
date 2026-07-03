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
import { isAdmin } from "@/lib/admin/roles";
import { safeNext } from "@/lib/auth/redirect";
import { signInSchema, type SignInValues } from "@/lib/auth/schema";
import { supabase } from "@/lib/db/client";
import { ROUTES } from "@/lib/routes";

/**
 * Admin sign-in (email + password). On success we re-check the role client-side
 * before navigating: a valid non-admin login is signed straight back out with a
 * clear message, so only admins ever reach the console. The server gate
 * (`requireAdmin`) enforces this authoritatively regardless.
 */
export function AdminSignInForm({ next }: { next: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  const safe = safeNext(next, ROUTES.admin);
  const target = safe.startsWith("/admin") ? safe : ROUTES.admin;

  const onValid = async (values: SignInValues) => {
    setFormError(null);
    const { data, error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setFormError(
        error.message === "Invalid login credentials"
          ? "That email and password don't match. Please try again."
          : "We couldn't sign you in just now. Please try again.",
      );
      return;
    }
    if (!isAdmin(data.user)) {
      await supabase.auth.signOut();
      setFormError("This account doesn't have admin access.");
      return;
    }
    window.location.assign(target);
  };

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
      <AuthField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        registration={register("password")}
      />
      <AuthError message={formError} />
      <AuthSubmit isBusy={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign In"}
      </AuthSubmit>
      <AuthLink href={ROUTES.adminForgotPassword}>Forgot your password?</AuthLink>
    </form>
  );
}

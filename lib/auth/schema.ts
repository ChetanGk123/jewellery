/**
 * Shared auth validation — pure zod, used by the client forms (React Hook Form
 * resolvers) on the sign-in/up, OTP and password screens. Supabase Auth is the
 * authoritative server-side gate; these schemas are the UX layer that catches
 * typos before a round-trip.
 */

import { z } from "zod";

/** Normalised email: trimmed, valid shape, sane length. */
export const emailField = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(120, "Email is too long.");

/** Supabase bcrypt caps at 72 bytes; 8+ is the project floor. */
export const passwordField = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Password is too long.");

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(80, "Name is too long."),
  email: emailField,
  password: passwordField,
});
export type SignUpValues = z.infer<typeof signUpSchema>;

export const otpRequestSchema = z.object({ email: emailField });
export type OtpRequestValues = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  email: emailField,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
});
export type OtpVerifyValues = z.infer<typeof otpVerifySchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({ password: passwordField });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

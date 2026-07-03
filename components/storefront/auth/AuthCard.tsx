import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared shell + primitives for the auth screens (sign in / sign up / password
 * flows). No prototype exists for these, so they mirror the storefront's
 * checkout language: cream page, `#FFFDF8` card with `#E7D9C2` hairlines,
 * Cormorant display heading, Jost body, sharp 2–4px radii, gold gradient CTA.
 */

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Small line under the card — e.g. "New here? Create an account". */
  footer?: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-start justify-center bg-cream-100 px-6 py-16">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col gap-5 rounded border border-[#E7D9C2] bg-[#FFFDF8] p-8">
          <header className="flex flex-col gap-1.5">
            <h1 className="m-0 font-heading text-[28px] font-semibold leading-tight text-maroon-900">
              {title}
            </h1>
            {subtitle && (
              <p className="m-0 text-[13.5px] font-light leading-relaxed text-[#5E4A44]">
                {subtitle}
              </p>
            )}
          </header>
          {children}
        </div>
        {footer && (
          <p className="mt-4 text-center text-[13px] text-[#5E4A44]">{footer}</p>
        )}
      </div>
    </main>
  );
}

/** Text input matching the checkout form's field styling. */
export function AuthField({
  id,
  label,
  type = "text",
  autoComplete,
  inputMode,
  error,
  registration,
}: {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  inputMode?: "text" | "email" | "numeric";
  error?: string;
  /** Spread of `register(...)` from react-hook-form. */
  registration: Record<string, unknown>;
}) {
  const borderClass = error
    ? "border-[#D98A94] focus:border-[#B23A48]"
    : "border-[#E7D9C2] focus:border-gold-400";

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[12px] font-semibold uppercase leading-none tracking-[0.12em] text-maroon-900"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-[2px] border ${borderClass} bg-white px-3.5 py-[13px] text-[14px] text-maroon-900 outline-none`}
        {...registration}
      />
      {error && (
        <p id={`${id}-error`} className="m-0 text-[12px] leading-snug text-[#B23A48]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Gold-gradient primary submit, matching the checkout CTA. */
export function AuthSubmit({
  children,
  isBusy,
}: {
  children: ReactNode;
  isBusy?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={isBusy}
      className="rounded-sm border-none bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-4 py-[15px] text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#3A0E18] shadow-[0_10px_24px_rgba(168,122,30,0.28)] transition-[filter] hover:brightness-105 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** Inline form-level error, matching the checkout error panel. */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="m-0 rounded-sm border border-[#F0C8CE] bg-[#FBEAEC] px-3.5 py-3 text-[13px] leading-snug text-[#B23A48]"
    >
      {message}
    </p>
  );
}

/** Quiet auxiliary link (forgot password, back to sign in, …). */
export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[13px] font-medium text-maroon-700 underline-offset-4 transition-colors hover:text-maroon-900 hover:underline"
    >
      {children}
    </Link>
  );
}

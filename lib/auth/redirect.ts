import { ROUTES } from "@/lib/routes"

/**
 * Sanitize a post-auth `next` redirect target. Auth entry points carry the
 * destination in a query param (`/sign-in?next=/checkout`), which an attacker
 * could point at their own site (open redirect) — a classic phishing step-up
 * after a real sign-in. Only same-origin, absolute-path targets survive:
 *
 *   "/checkout"          -> "/checkout"
 *   "https://evil.com"   -> fallback
 *   "//evil.com"         -> fallback   (protocol-relative)
 *   "/\\evil.com"        -> fallback   (backslash trick)
 *   "javascript:…"       -> fallback
 */
export function safeNext(
  next: string | null | undefined,
  fallback: string = ROUTES.account,
): string {
  if (!next) return fallback
  // Must be an absolute path on our origin: exactly one leading slash, and no
  // backslashes anywhere (browsers normalise them into slashes).
  if (!next.startsWith("/")) return fallback
  if (next.startsWith("//") || next.includes("\\")) return fallback
  return next
}

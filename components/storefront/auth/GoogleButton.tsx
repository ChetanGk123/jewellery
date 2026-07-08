"use client"

import { useState } from "react"
import { ROUTES } from "@/lib/routes"
import { supabase } from "@/lib/db/client"
import { AuthError } from "./AuthCard"

/**
 * "Continue with Google" — Supabase OAuth (PKCE). Google bounces back to
 * `/auth/callback?next=…`, which exchanges the code for a session cookie.
 * Shows a friendly error if the provider isn't enabled in the Supabase
 * dashboard yet (a manual, dashboard-side setup step).
 */
export function GoogleButton({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const signInWithGoogle = async () => {
    setError(null)
    setIsBusy(true)
    const redirectTo = `${window.location.origin}${ROUTES.authCallback}?next=${encodeURIComponent(next)}`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    })
    if (oauthError) {
      setIsBusy(false)
      setError("Google sign-in isn't available right now. Please use email instead.")
    }
    // On success the browser navigates away to Google — no state to reset.
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={isBusy}
        className="flex items-center justify-center gap-2.5 rounded-sm border border-[#E7D9C2] bg-white px-4 py-[13px] text-[13px] font-semibold leading-none text-maroon-900 transition-colors hover:border-gold-400 disabled:opacity-60"
      >
        <GoogleMark />
        {isBusy ? "Redirecting…" : "Continue with Google"}
      </button>
      <AuthError message={error} />
    </div>
  )
}

/** Official four-colour Google "G", inline so no external asset is needed. */
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

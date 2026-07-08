"use client"

import { useState } from "react"
import { supabase } from "@/lib/db/client"
import { ROUTES } from "@/lib/routes"

/**
 * Sidebar sign-out. Full navigation to the admin sign-in so the server layout
 * re-renders with the cleared session (the gate then keeps the console closed).
 */
export function AdminSignOutButton() {
  const [isBusy, setIsBusy] = useState(false)

  const signOut = async () => {
    setIsBusy(true)
    await supabase.auth.signOut()
    window.location.assign(ROUTES.adminSignIn)
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={isBusy}
      aria-label="Sign out"
      title="Sign out"
      className="flex-none rounded-md p-2 text-[#9C7A6E] transition-colors hover:bg-gold-300/[0.06] hover:text-gold-300 disabled:opacity-60"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        aria-hidden="true"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    </button>
  )
}

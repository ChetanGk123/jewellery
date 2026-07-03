"use client";

import { useState } from "react";
import { supabase } from "@/lib/db/client";
import { ROUTES } from "@/lib/routes";

/**
 * Sign out and return to the home page (full navigation so the server layout
 * re-renders with the cleared session — header flips back to "Sign In").
 */
export function SignOutButton() {
  const [isBusy, setIsBusy] = useState(false);

  const signOut = async () => {
    setIsBusy(true);
    await supabase.auth.signOut();
    window.location.assign(ROUTES.home);
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={isBusy}
      className="self-start rounded-sm border border-[#E7D9C2] bg-white px-5 py-3 text-[12px] font-semibold uppercase leading-none tracking-[0.12em] text-maroon-700 transition-colors hover:border-maroon-700 disabled:opacity-60"
    >
      {isBusy ? "Signing out…" : "Sign Out"}
    </button>
  );
}

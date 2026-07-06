"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Visible failure state for admin reads (TASKS 5.1). Rendered by a console page
 * when its loader returns `error: true`, so an operator sees "couldn't load"
 * instead of a healthy-looking empty view. Retry re-runs the server component
 * via `router.refresh()`.
 */
export function AdminErrorBanner({
  message = "We couldn't load this data. It may be a temporary connection issue.",
}: {
  message?: string;
}) {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-[#E5B4B0] bg-[#FBEDEC] px-5 py-4 text-[#8A2B22] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-lg leading-none">
          ⚠
        </span>
        <div>
          <p className="font-medium">Couldn&rsquo;t load</p>
          <p className="text-sm text-[#9B4A42]">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isRetrying}
        className="shrink-0 rounded-lg border border-[#C0392F] bg-white px-4 py-2 text-sm font-medium text-[#8A2B22] transition-colors hover:bg-[#C0392F] hover:text-white disabled:opacity-60"
      >
        {isRetrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

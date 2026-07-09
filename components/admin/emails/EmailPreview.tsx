"use client"

import { useState } from "react"
import type { EmailMessage } from "@/lib/email/order-confirmation"

/**
 * Live inbox-style preview (TASKS 7.5): subject line + the built HTML in a
 * sandboxed iframe (`srcDoc`, no scripts/navigation), with a desktop/mobile
 * width toggle. Renders whatever message the parent builds from the CURRENT
 * form state, so edits show as you type.
 */

const WIDTHS = { desktop: 600, mobile: 375 } as const
type Width = keyof typeof WIDTHS

export function EmailPreview({ message }: { message: EmailMessage }) {
  const [width, setWidth] = useState<Width>("desktop")

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <span className="font-body text-[11px] font-semibold tracking-[0.08em] text-[#A79C8C]">
          LIVE PREVIEW
        </span>
        <div className="flex overflow-hidden rounded-lg border border-[#E2D8C8]" role="group" aria-label="Preview width">
          {(Object.keys(WIDTHS) as Width[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWidth(w)}
              aria-pressed={width === w}
              className={`px-3 py-1.5 font-body text-[12px] font-medium capitalize transition-colors ${
                width === w ? "bg-[#5B1A2E] text-[#F7EDE3]" : "bg-white text-[#4A4038] hover:bg-[#F5F1EA]"
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Subject as an inbox row — what the customer scans first. */}
      <div className="rounded-t-[10px] border border-b-0 border-[#E2D8C8] bg-white px-4 py-3">
        <div className="font-body text-[11px] uppercase tracking-[0.06em] text-[#A79C8C]">Subject</div>
        <div className="truncate font-body text-[14px] font-semibold text-[#241412]">
          {message.subject}
        </div>
      </div>

      <div className="flex justify-center overflow-x-auto rounded-b-[10px] border border-[#E2D8C8] bg-[#EAE3D7] p-3">
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={message.html}
          style={{ width: WIDTHS[width] }}
          className="h-[620px] max-w-full rounded-md border border-[#DDD4C6] bg-[#FBF6EE]"
        />
      </div>
    </div>
  )
}

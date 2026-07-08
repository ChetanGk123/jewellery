/**
 * Honest placeholder for an admin view whose chrome is live but whose content
 * lands in a later Phase 3 task. Rendered in the admin card language (white,
 * 12px radius, soft border) so the scaffold already looks like the real console.
 */
export function AdminPlaceholder({
  title,
  phase,
  description,
}: {
  title: string
  /** The Phase 3 task that builds this view, e.g. "3.3". */
  phase: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-[#EAE3D7] bg-white p-8 sm:p-10">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3E9DA]">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#A87A1E"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z" />
          <path d="M3 8.5 12 13l9-4.5M12 13v7" />
        </svg>
      </span>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <h2 className="font-heading text-[22px] font-semibold leading-none text-[#2A1F1A]">
          {title}
        </h2>
        <span className="rounded-full bg-[#F3E9DA] px-2.5 py-1 text-[11px] font-medium leading-none text-[#A87A1E]">
          Phase {phase}
        </span>
      </div>

      <p className="mt-2.5 max-w-[62ch] text-[14px] leading-relaxed text-[#5E4A40]">
        {description}
      </p>
      <p className="mt-4 text-[12.5px] leading-relaxed text-[#8A7E74]">
        The sidebar, topbar and routing are live. This view is scaffolded and gets its data and
        controls in Phase {phase}.
      </p>
    </div>
  )
}

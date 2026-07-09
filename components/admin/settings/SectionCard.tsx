"use client"

/**
 * One Settings section card (extracted from SettingsView when the Storage
 * card arrived): icon tile + heading header over a white rounded card, per
 * the operator's settings redesign.
 */
export function SectionCard({
  id,
  icon,
  iconBg,
  title,
  subtitle,
  headerRight,
  children,
}: {
  id: string
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  headerRight?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className="scroll-mt-24 overflow-hidden rounded-[14px] border border-[#E6DECF] bg-white"
    >
      <div className="flex items-center gap-3.5 border-b border-[#EFE9DE] px-[30px] py-[23px] max-sm:px-5">
        <div
          aria-hidden="true"
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-heading text-[21px] font-semibold leading-tight text-[#241412]">
            {title}
          </h2>
          <p className="m-0 mt-0.5 font-body text-[13px] leading-snug text-[#8B8177]">{subtitle}</p>
        </div>
        {headerRight}
      </div>
      {children}
    </section>
  )
}

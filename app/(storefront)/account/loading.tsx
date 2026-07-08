/**
 * Loading fallback for /account and /account/orders[/orderNo] — mirrors those
 * pages' shared shell: `max-w-[860px]` container, 32px heading row, then
 * stacked cream cards.
 */
export default function AccountLoading() {
  return (
    <main aria-hidden="true" className="mx-auto w-full max-w-[860px] flex-1 px-6 py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="h-8 w-48 animate-pulse rounded bg-[#EFE3D0]" />
        <div className="h-[13px] w-24 animate-pulse rounded bg-[#EFE3D0]" />
      </div>

      <div className="flex flex-col gap-5">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded border border-[#E7D9C2] bg-[#F3E9DA]"
          />
        ))}
      </div>
    </main>
  )
}

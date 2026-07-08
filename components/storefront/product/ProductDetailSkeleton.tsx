/**
 * Loading skeleton for `/product/[slug]` (Phase 4.3, aligned in 5.x) — mirrors
 * the real page's layout exactly: breadcrumb, then a `md:` two-column flex of
 * ProductGallery (aspect-square main + 4-col thumb grid) and the buy-box info
 * column, so nothing jumps when real data arrives. Every route is
 * force-dynamic (nonce CSP), so without this the nav felt like a dead click.
 */
export function ProductDetailSkeleton() {
  return (
    <main className="mx-auto max-w-[1280px] flex-1 px-6 pb-[70px] pt-[26px]" aria-hidden="true">
      <div className="mb-[26px] h-3 w-56 animate-pulse rounded bg-[#EFE3D0]" />

      <div className="flex flex-col gap-10 md:flex-row md:flex-wrap md:gap-12">
        {/* Gallery column (mirrors ProductGallery) */}
        <div className="flex flex-col gap-3.5 md:min-w-[300px] md:flex-1">
          <div className="aspect-square w-full animate-pulse rounded-[4px] border border-[#EFE3D0] bg-[#F3E9DA]" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-[3px] bg-[#F3E9DA]" />
            ))}
          </div>
        </div>

        {/* Info / buy-box column */}
        <div className="flex w-full max-w-[520px] flex-col gap-[18px] md:min-w-[300px] md:flex-1">
          <div className="flex flex-col gap-2.5">
            <div className="h-[11px] w-40 animate-pulse rounded bg-[#EFE3D0]" />
            <div className="h-[42px] w-3/4 animate-pulse rounded bg-[#EFE3D0]" />
            <div className="h-[13px] w-32 animate-pulse rounded bg-[#EFE3D0]" />
          </div>
          <div className="h-8 w-40 animate-pulse rounded bg-[#EFE3D0]" />
          <div className="h-16 w-full animate-pulse rounded bg-[#EFE3D0]" />
          <div className="flex gap-2.5">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-10 w-24 animate-pulse rounded-sm bg-[#EFE3D0]" />
            ))}
          </div>
          <div className="h-12 w-full animate-pulse rounded-sm bg-[#EFE3D0]" />
        </div>
      </div>
    </main>
  )
}

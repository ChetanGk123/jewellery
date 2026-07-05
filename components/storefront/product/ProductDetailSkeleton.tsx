/**
 * Loading skeleton for `/product/[slug]` (Phase 4.3) — mirrors the gallery +
 * buy-box two-column shape so the layout doesn't jump when real data
 * arrives. Every route is force-dynamic (nonce CSP), so without this the
 * nav felt like a dead click.
 */
export function ProductDetailSkeleton() {
  return (
    <main
      className="mx-auto max-w-[1280px] px-6 pb-16 pt-[26px]"
      aria-hidden="true"
    >
      <div className="mb-[18px] h-3 w-56 animate-pulse rounded bg-[#EFE3D0]" />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="aspect-square w-full animate-pulse rounded-[3px] bg-[#F3E9DA]" />
          <div className="flex gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="h-20 w-20 animate-pulse rounded-[3px] bg-[#F3E9DA]"
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="h-3 w-40 animate-pulse rounded bg-[#EFE3D0]" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-[#EFE3D0]" />
          <div className="h-4 w-32 animate-pulse rounded bg-[#EFE3D0]" />
          <div className="h-8 w-40 animate-pulse rounded bg-[#EFE3D0]" />
          <div className="h-16 w-full animate-pulse rounded bg-[#EFE3D0]" />
          <div className="flex gap-2.5">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="h-10 w-20 animate-pulse rounded-sm bg-[#EFE3D0]"
              />
            ))}
          </div>
          <div className="h-12 w-full animate-pulse rounded-sm bg-[#EFE3D0]" />
        </div>
      </div>
    </main>
  );
}

/**
 * Loading skeleton for `/shop` and `/{category}` (Phase 4.3) — mirrors
 * `ProductListing`'s breadcrumb/header/sidebar/grid shape so the layout
 * doesn't jump when real data arrives. Every route is force-dynamic (nonce
 * CSP), so without this the nav felt like a dead click.
 */
export function ListingSkeleton() {
  return (
    <main
      className="mx-auto max-w-[1280px] flex-1 px-6 pb-[70px] pt-[26px]"
      aria-hidden="true"
    >
      <div className="mb-[22px] h-3 w-40 animate-pulse rounded bg-[#EFE3D0]" />

      <header className="mb-7 flex flex-wrap items-end justify-between gap-3.5 border-b border-[#E7D9C2] pb-[22px]">
        <div className="flex flex-col gap-1.5">
          <div className="h-[42px] w-48 animate-pulse rounded bg-[#EFE3D0]" />
          <div className="h-[13px] w-24 animate-pulse rounded bg-[#EFE3D0]" />
        </div>
        <div className="h-9 w-40 animate-pulse rounded bg-[#EFE3D0]" />
      </header>

      <div className="flex flex-col gap-9 lg:flex-row lg:items-start">
        <div className="flex w-full flex-col gap-3.5 lg:w-[230px] lg:flex-none lg:gap-[30px]">
          {/* Mobile "Filters" disclosure bar (real sidebar shows it below lg) */}
          <div className="h-[38px] w-full animate-pulse rounded-sm bg-[#EFE3D0] lg:hidden" />
          <div className="hidden h-40 animate-pulse rounded bg-[#EFE3D0] lg:block" />
          <div className="hidden h-24 animate-pulse rounded bg-[#EFE3D0] lg:block" />
          <div className="hidden h-16 animate-pulse rounded bg-[#EFE3D0] lg:block" />
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-[22px] sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-[3px] border border-[#EFE3D0] bg-white"
            >
              <div className="aspect-square animate-pulse bg-[#F3E9DA]" />
              <div className="flex flex-col gap-[7px] px-4 pb-[18px] pt-4">
                <div className="h-2.5 w-16 animate-pulse rounded bg-[#EFE3D0]" />
                <div className="h-6 w-3/4 animate-pulse rounded bg-[#EFE3D0]" />
                <div className="h-4 w-20 animate-pulse rounded bg-[#EFE3D0]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

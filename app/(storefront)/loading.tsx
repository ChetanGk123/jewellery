/**
 * Group-level loading fallback for storefront routes (TASKS 4.18). Every route
 * is dynamically rendered (the nonce CSP reads headers() in the root layout),
 * so without a loading boundary navigations block on the server render. Routes
 * with a closer-shaped skeleton (e.g. /shop's ListingSkeleton) keep their own;
 * this covers the rest (home, cart, checkout, account, help/legal) with a
 * neutral shimmer in the Phase 4.3 skeleton palette.
 */
export default function StorefrontLoading() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-[1200px] px-5 py-10 md:px-10"
    >
      {/* Breadcrumb bar */}
      <div className="h-3 w-40 animate-pulse rounded bg-[#EFE3D0]" />

      {/* Title block */}
      <div className="mt-6 h-8 w-64 animate-pulse rounded bg-[#EFE3D0]" />
      <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-[#F3E9DA]" />

      {/* Two-column body */}
      <div className="mt-10 flex flex-col gap-8 md:flex-row">
        <div className="h-[340px] flex-1 animate-pulse rounded-sm bg-[#F3E9DA]" />
        <div className="flex w-full flex-col gap-4 md:w-[340px]">
          <div className="h-24 animate-pulse rounded-sm bg-[#EFE3D0]" />
          <div className="h-24 animate-pulse rounded-sm bg-[#EFE3D0]" />
          <div className="h-40 animate-pulse rounded-sm bg-[#EFE3D0]" />
        </div>
      </div>
    </div>
  );
}

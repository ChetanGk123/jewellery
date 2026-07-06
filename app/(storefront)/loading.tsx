/**
 * Group-level loading fallback for storefront routes without a closer-shaped
 * skeleton (TASKS 4.18, aligned in 5.x). Every route is dynamically rendered
 * (nonce CSP), so without a boundary navigations block on the server render.
 *
 * Shape: the routes that reach this fallback (home, help/legal pages) all open
 * with the same full-bleed maroon-gradient hero band (Hero / HelpHeader), so
 * the skeleton mirrors that: a dark hero with light placeholder lines, then a
 * centered content section. Cart/checkout/account/order carry their own
 * closer-shaped loading files.
 */
export default function StorefrontLoading() {
  return (
    <div aria-hidden="true" className="flex-1">
      {/* Full-bleed maroon hero band (Hero / HelpHeader share this gradient) */}
      <section className="bg-[linear-gradient(120deg,#4A0E1C,#71182B_55%,#5E1322)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-6 py-16">
          <div className="h-3 w-40 animate-pulse rounded bg-[#FBF1DE]/20" />
          <div className="h-12 w-72 max-w-full animate-pulse rounded bg-[#FBF1DE]/25" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-[#FBF1DE]/15" />
        </div>
      </section>

      {/* Content section below the hero */}
      <section className="mx-auto max-w-[1280px] px-6 py-14">
        <div className="mx-auto mb-9 flex max-w-[420px] flex-col items-center gap-2.5">
          <div className="h-3 w-28 animate-pulse rounded bg-[#EFE3D0]" />
          <div className="h-9 w-64 animate-pulse rounded bg-[#EFE3D0]" />
        </div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="aspect-[1/1.12] animate-pulse rounded-[3px] border border-[#EFE3D0] bg-[#F3E9DA]"
            />
          ))}
        </div>
      </section>
    </div>
  );
}

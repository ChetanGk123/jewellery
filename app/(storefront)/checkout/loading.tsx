/**
 * Loading fallback for /checkout — mirrors the real page: `max-w-[1180px]`
 * container, Cart/Checkout breadcrumb, 44px "Checkout" heading, then the
 * two-column flex of form fields + the 360px order summary (CheckoutSummary).
 */
export default function CheckoutLoading() {
  return (
    <main
      aria-hidden="true"
      className="mx-auto w-full max-w-[1180px] flex-1 px-6 pb-20 pt-[30px]"
    >
      <div className="mb-[18px] h-3 w-32 animate-pulse rounded bg-[#EFE3D0]" />
      <div className="mb-7 h-11 w-64 animate-pulse rounded bg-[#EFE3D0]" />

      <div className="flex flex-wrap items-start gap-10">
        <div className="flex min-w-full flex-col gap-4 md:min-w-[300px] md:flex-1">
          <div className="h-5 w-44 animate-pulse rounded bg-[#EFE3D0]" />
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-sm border border-[#EFE3D0] bg-[#F3E9DA]"
            />
          ))}
        </div>
        <div className="h-[420px] w-full animate-pulse rounded border border-[#E7D9C2] bg-[#F3E9DA] md:w-[360px] md:flex-none" />
      </div>
    </main>
  );
}

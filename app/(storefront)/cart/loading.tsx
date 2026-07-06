/**
 * Loading fallback for /cart — mirrors the real page: `max-w-[1180px]`
 * container, 44px "Your Cart" heading, then CartView's two-column flex of
 * item rows + the 360px summary card (CartSummary), so nothing jumps when
 * the page streams in.
 */
export default function CartLoading() {
  return (
    <main
      aria-hidden="true"
      className="mx-auto w-full max-w-[1180px] flex-1 px-6 pb-20 pt-[30px]"
    >
      <div className="mb-7 h-11 w-56 animate-pulse rounded bg-[#EFE3D0]" />

      <div className="flex flex-wrap items-start gap-10">
        <div className="flex min-w-full flex-col gap-4 md:min-w-[300px] md:flex-1">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded border border-[#EFE3D0] bg-[#F3E9DA]"
            />
          ))}
        </div>
        <div className="h-[360px] w-full animate-pulse rounded border border-[#E7D9C2] bg-[#F3E9DA] md:w-[360px] md:flex-none" />
      </div>
    </main>
  );
}

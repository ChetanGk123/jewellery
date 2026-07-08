/**
 * Loading fallback for /order/[orderNo] (post-checkout confirmation) —
 * mirrors OrderConfirmation's centered column: gold check circle, heading,
 * intro line, then the summary card.
 */
export default function OrderConfirmationLoading() {
  return (
    <main
      aria-hidden="true"
      className="mx-auto flex max-w-[680px] flex-1 flex-col items-center gap-[18px] px-6 pb-[90px] pt-[70px] text-center"
    >
      <div className="h-[88px] w-[88px] animate-pulse rounded-full bg-[#F3E9DA]" />
      <div className="h-10 w-80 max-w-full animate-pulse rounded bg-[#EFE3D0]" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-[#F3E9DA]" />
      <div className="mt-2 h-56 w-full max-w-[420px] animate-pulse rounded border border-[#E7D9C2] bg-[#FFFDF8]" />
    </main>
  )
}

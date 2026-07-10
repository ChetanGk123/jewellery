import { formatPaise } from "@/lib/utils/money"

type TrustStripProps = {
  /** Free-shipping threshold from store settings, so the copy matches checkout. */
  freeShipThresholdPaise: number
  /** Whether COD is currently offered — hides the COD reassurance when off. */
  codEnabled: boolean
}

/**
 * Four reassurance points in a cream strip below the hero — copy matched to
 * the storefront prototype, with the free-ship amount and COD availability
 * taken from store settings rather than hardcoded.
 */
export function TrustStrip({ freeShipThresholdPaise, codEnabled }: TrustStripProps) {
  const items = [
    {
      icon: "✈",
      title: "Free Shipping",
      sub: `On all orders over ${formatPaise(freeShipThresholdPaise)}`,
    },
    ...(codEnabled ? [{ icon: "₹", title: "Cash on Delivery", sub: "Pay when it arrives" }] : []),
    { icon: "↺", title: "7-Day Returns", sub: "Easy & hassle-free" },
    { icon: "✨", title: "Skin-Friendly", sub: "Anti-tarnish plating" },
  ]

  return (
    <section className="border-b border-[#EFE3D0] bg-cream-50">
      <ul className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-4 px-6 py-[22px]">
        {items.map((item) => (
          <li key={item.title} className="flex min-w-[200px] flex-1 items-center gap-[11px]">
            <span className="text-[22px] leading-none text-gold-400" aria-hidden>
              {item.icon}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold leading-tight text-maroon-900">
                {item.title}
              </span>
              <span className="text-[12px] font-normal leading-snug text-[#7A655F]">
                {item.sub}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

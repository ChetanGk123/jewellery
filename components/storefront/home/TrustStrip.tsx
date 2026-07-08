/** Trust items shown under the hero — copy matched to the storefront prototype. */
const TRUST_ITEMS = [
  { icon: "✈", title: "Free Shipping", sub: "On all orders over ₹999" },
  { icon: "₹", title: "Cash on Delivery", sub: "Pay when it arrives" },
  { icon: "↺", title: "7-Day Returns", sub: "Easy & hassle-free" },
  { icon: "✨", title: "Skin-Friendly", sub: "Anti-tarnish plating" },
] as const

/** Four reassurance points in a cream strip below the hero. */
export function TrustStrip() {
  return (
    <section className="border-b border-[#EFE3D0] bg-cream-50">
      <ul className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-4 px-6 py-[22px]">
        {TRUST_ITEMS.map((item) => (
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

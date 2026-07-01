import Link from "next/link";

const SHOP_LINKS = [
  { href: "/shop", label: "All Jewellery" },
  { href: "/bridal-sets", label: "Bridal Sets" },
  { href: "/necklaces", label: "Necklaces" },
  { href: "/earrings", label: "Earrings" },
];

const HELP_LINKS = [
  { href: "/shipping", label: "Shipping & Returns" },
  { href: "/track", label: "Track Order" },
  { href: "/care", label: "Care Guide" },
  { href: "/contact", label: "Contact Us" },
];

const SOCIALS = [
  { glyph: "f", label: "Facebook" },
  { glyph: "♢", label: "Instagram" },
  { glyph: "💬", label: "WhatsApp" },
];

/**
 * Storefront footer, matched to `refereces/JR Jewellers Storefront.html`:
 * deep-maroon panel with a brand blurb + socials, Shop/Help columns, a
 * newsletter signup (UI-only for now), and a payments/GST strip.
 */
export function Footer() {
  return (
    <footer className="mt-auto bg-maroon-950 text-[#D9C2B8]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-10 px-6 pt-14 pb-[30px]">
        <div className="flex min-w-[240px] max-w-[320px] flex-1 flex-col gap-[14px]">
          <span className="font-display text-2xl leading-none tracking-[0.14em] text-gold-300">
            JR JEWELLERS
          </span>
          <p className="m-0 text-[13px] font-light leading-[1.7] text-[#C3A89D]">
            Handcrafted artificial bridal jewellery — Kundan, polki, temple &amp;
            pearl. Made in India, shipped nationwide.
          </p>
          <div className="mt-1.5 flex gap-3">
            {SOCIALS.map((social) => (
              <span
                key={social.label}
                aria-label={social.label}
                className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full border border-gold-300/40 text-sm text-gold-300 transition-colors hover:bg-gold-300/10"
              >
                {social.glyph}
              </span>
            ))}
          </div>
        </div>

        <FooterColumn title="Shop" links={SHOP_LINKS} />
        <FooterColumn title="Help" links={HELP_LINKS} />

        <div className="flex min-w-[200px] flex-col gap-3">
          <span className="text-xs font-semibold uppercase leading-none tracking-[0.16em] text-gold-300">
            Stay in touch
          </span>
          <p className="m-0 text-[13px] font-light leading-[1.5] text-[#C3A89D]">
            Offers, new drops &amp; bridal inspiration.
          </p>
          <form className="flex overflow-hidden rounded-sm border border-gold-300/40 focus-within:border-gold-300">
            <input
              type="email"
              name="email"
              aria-label="Email address"
              placeholder="Your email"
              className="min-w-0 flex-1 border-none bg-transparent px-3 py-[11px] text-xs text-gold-300 outline-none placeholder:text-gold-300/60"
            />
            <button
              type="submit"
              className="cursor-pointer border-none bg-gold-300 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-maroon-950 transition-colors hover:bg-gold-400"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-gold-300/20">
        <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 px-6 py-[18px]">
          <span className="text-[11.5px] font-light leading-none text-[#9C8278]">
            © {new Date().getFullYear()} JR Jewellers · GST registered · Made in India
          </span>
          <span className="text-[11.5px] font-light leading-none text-[#9C8278]">
            UPI · Cards · Netbanking · COD · Razorpay Secured
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="flex min-w-[140px] flex-col gap-3">
      <span className="text-xs font-semibold uppercase leading-none tracking-[0.16em] text-gold-300">
        {title}
      </span>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-[13px] font-light leading-none text-[#C3A89D] transition-colors hover:text-gold-300"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

import Link from "next/link";

const SHOP = [
  { href: "/category/bridal-sets", label: "Bridal Sets" },
  { href: "/category/necklaces", label: "Necklaces" },
  { href: "/category/earrings", label: "Earrings" },
  { href: "/category/bangles-bracelets", label: "Bangles" },
];

const HELP = [
  { href: "/shipping", label: "Shipping & Returns" },
  { href: "/care", label: "Jewellery Care" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="mt-auto bg-maroon-950 text-cream-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <p className="font-display text-2xl tracking-[0.06em] text-cream-50">JR Jewellers</p>
          <p className="max-w-xs text-sm leading-relaxed text-cream-200/80">
            Handcrafted Kundan, Polki and temple jewellery for the Indian bride.
          </p>
        </div>

        <FooterColumn title="Shop" links={SHOP} />
        <FooterColumn title="Help" links={HELP} />

        <div className="space-y-2 text-sm text-cream-200/80">
          <p className="text-xs uppercase tracking-[0.16em] text-gold-300">Contact</p>
          <p>WhatsApp enquiries welcome</p>
          <p>Cash on Delivery across India</p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-5 text-xs text-cream-200/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} JR Jewellers. All rights reserved.</p>
          <p>Prices in INR (₹), inclusive of GST.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-[0.16em] text-gold-300">{title}</p>
      <ul className="space-y-2 text-sm text-cream-200/80">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="transition-colors hover:text-gold-300">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

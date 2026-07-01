import Link from "next/link";

const NAV_LINKS = [
  { href: "/shop", label: "Shop All" },
  { href: "/category/bridal-sets", label: "Bridal" },
  { href: "/category/necklaces", label: "Necklaces" },
  { href: "/category/earrings", label: "Earrings" },
  { href: "/about", label: "Our Story" },
] as const;

/**
 * Storefront header: slim maroon announcement bar over a cream brand row.
 * Cart count is a stub (0) until the cart store lands in Phase 2.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-maroon-950 text-gold-300">
        <p className="mx-auto max-w-7xl px-4 py-2 text-center text-[11px] uppercase tracking-[0.18em]">
          Complimentary shipping over ₹999 · Cash on Delivery across India
        </p>
      </div>

      <div className="border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4">
          <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-b border-transparent pb-0.5 text-xs uppercase tracking-[0.14em] text-maroon-900 transition-colors hover:border-accent hover:text-accent"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            aria-label="Open menu"
            className="justify-self-start text-maroon-900 md:hidden"
          >
            <MenuIcon />
          </button>

          <Link
            href="/"
            className="justify-self-center font-display text-2xl tracking-[0.06em] text-maroon-950"
          >
            JR Jewellers
          </Link>

          <div className="flex items-center justify-end gap-4 text-maroon-900">
            <Link href="/shop" aria-label="Search" className="transition-colors hover:text-accent">
              <SearchIcon />
            </Link>
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative transition-colors hover:text-accent"
            >
              <BagIcon />
              <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-medium text-cream-50">
                0
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8Z" strokeLinejoin="round" />
      <path d="M9 8a3 3 0 0 1 6 0" strokeLinecap="round" />
    </svg>
  );
}

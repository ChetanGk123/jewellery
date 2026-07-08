import { ROUTES } from "./routes"

export type NavLink = { href: string; label: string }

/** Primary header menu — "All Jewellery" plus the featured category slugs. */
export const PRIMARY_NAV: NavLink[] = [
  { href: ROUTES.shop, label: "All Jewellery" },
  { href: ROUTES.category("bridal-sets"), label: "Bridal Sets" },
  { href: ROUTES.category("necklaces"), label: "Necklaces" },
  { href: ROUTES.category("earrings"), label: "Earrings" },
  { href: ROUTES.category("bangles-bracelets"), label: "Bangles & Bracelets" },
  { href: ROUTES.category("maang-tikka"), label: "Maang Tikka" },
  { href: ROUTES.category("hand-jewellery"), label: "Hand Jewellery" },
]

/** Footer "Shop" column — a shorter subset of the primary nav. */
export const FOOTER_SHOP_LINKS: NavLink[] = [
  { href: ROUTES.shop, label: "All Jewellery" },
  { href: ROUTES.category("bridal-sets"), label: "Bridal Sets" },
  { href: ROUTES.category("necklaces"), label: "Necklaces" },
  { href: ROUTES.category("earrings"), label: "Earrings" },
]

/** Footer "Help" column. */
export const FOOTER_HELP_LINKS: NavLink[] = [
  { href: ROUTES.shipping, label: "Shipping & Returns" },
  { href: ROUTES.track, label: "Track Order" },
  { href: ROUTES.care, label: "Care Guide" },
  { href: ROUTES.contact, label: "Contact Us" },
]

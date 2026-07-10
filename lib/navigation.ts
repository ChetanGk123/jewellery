import { ROUTES } from "./routes"

export type NavLink = { href: string; label: string }

/** The category fields the nav builders need (a slice of `Category`). */
type NavCategory = { name: string; slug: string }

/** How many categories the footer "Shop" column lists after "All Jewellery". */
const FOOTER_SHOP_CATEGORY_COUNT = 3

/**
 * Primary header menu — "All Jewellery" plus the live categories (in the
 * admin-managed sort order the caller fetched them in). Built from the DB
 * rather than hardcoded so admin category changes show up in the chrome.
 */
export function buildPrimaryNav(categories: NavCategory[]): NavLink[] {
  return [
    { href: ROUTES.shop, label: "All Jewellery" },
    ...categories.map((c) => ({ href: ROUTES.category(c.slug), label: c.name })),
  ]
}

/** Footer "Shop" column — "All Jewellery" plus the first few categories. */
export function buildFooterShopLinks(categories: NavCategory[]): NavLink[] {
  return buildPrimaryNav(categories.slice(0, FOOTER_SHOP_CATEGORY_COUNT))
}

/** Footer "Help" column. */
export const FOOTER_HELP_LINKS: NavLink[] = [
  { href: ROUTES.shipping, label: "Shipping & Returns" },
  { href: ROUTES.track, label: "Track Order" },
  { href: ROUTES.care, label: "Care Guide" },
  { href: ROUTES.contact, label: "Contact Us" },
]

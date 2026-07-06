import { ROUTES } from "@/lib/routes";

/**
 * Admin console navigation registry — single source of truth for the sidebar
 * items and each view's topbar title/subtitle (mirrors how `lib/navigation.ts`
 * drives the storefront). Add a view here and both the sidebar and the topbar
 * follow. Order matches the prototype's sidebar top-to-bottom.
 */

/** Live sidebar count badges (from `getAdminNavCounts`). */
export type AdminBadgeKey = "orders" | "reviews" | "messages";

/** Icon slots — resolved to SVGs in `AdminNavIcons`. */
export type AdminIconKey =
  | "dashboard"
  | "orders"
  | "products"
  | "analytics"
  | "categories"
  | "coupons"
  | "reviews"
  | "messages"
  | "subscribers"
  | "settings"
  | "team";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminIconKey;
  /** Which live count (if any) renders as a badge on this item. */
  badge?: AdminBadgeKey;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: ROUTES.admin, label: "Dashboard", icon: "dashboard" },
  { href: ROUTES.adminOrders, label: "Orders", icon: "orders", badge: "orders" },
  { href: ROUTES.adminProducts, label: "Products", icon: "products" },
  { href: ROUTES.adminAnalytics, label: "Analytics", icon: "analytics" },
  { href: ROUTES.adminCategories, label: "Categories", icon: "categories" },
  {
    href: ROUTES.adminCoupons,
    label: "Coupons & Offers",
    icon: "coupons",
  },
  {
    href: ROUTES.adminReviews,
    label: "Reviews",
    icon: "reviews",
    badge: "reviews",
  },
  {
    href: ROUTES.adminMessages,
    label: "Messages",
    icon: "messages",
    badge: "messages",
  },
  { href: ROUTES.adminSubscribers, label: "Subscribers", icon: "subscribers" },
  { href: ROUTES.adminSettings, label: "Settings", icon: "settings" },
  { href: ROUTES.adminTeam, label: "Team", icon: "team" },
];

/** Topbar page heading + subtitle, keyed by route path. */
export type AdminPageMeta = { title: string; subtitle: string };

export const ADMIN_PAGE_META: Record<string, AdminPageMeta> = {
  [ROUTES.admin]: { title: "Dashboard", subtitle: "Today at a glance" },
  [ROUTES.adminOrders]: {
    title: "Orders",
    subtitle: "Process and fulfil customer orders",
  },
  [ROUTES.adminProducts]: {
    title: "Products",
    subtitle: "Manage your catalogue",
  },
  [ROUTES.adminAnalytics]: {
    title: "Product Analytics",
    subtitle: "Sales performance and trends",
  },
  [ROUTES.adminCategories]: {
    title: "Categories",
    subtitle: "Organise your collections",
  },
  [ROUTES.adminCoupons]: {
    title: "Coupons & Offers",
    subtitle: "Discount codes and promotions",
  },
  [ROUTES.adminReviews]: {
    title: "Reviews",
    subtitle: "Moderate customer reviews",
  },
  [ROUTES.adminMessages]: {
    title: "Messages",
    subtitle: "Customer enquiries from the contact form",
  },
  [ROUTES.adminSubscribers]: {
    title: "Subscribers",
    subtitle: "Your newsletter audience",
  },
  [ROUTES.adminSettings]: {
    title: "Settings",
    subtitle: "Store configuration",
  },
  [ROUTES.adminTeam]: {
    title: "Team",
    subtitle: "Manage who can access the admin console",
  },
};

/** Topbar meta for a path, falling back to the Dashboard heading. */
export function adminPageMeta(pathname: string): AdminPageMeta {
  return ADMIN_PAGE_META[pathname] ?? ADMIN_PAGE_META[ROUTES.admin];
}

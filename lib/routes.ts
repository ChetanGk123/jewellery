/**
 * Central route registry — the single source of truth for storefront URLs.
 * Change a path here and every link follows, so route-scheme decisions live in
 * one place (e.g. the category listing is a bare `/{slug}` at the storefront
 * root per ARCHITECTURE_PLAN §4 — flip it here to namespace it later).
 *
 * Static routes are strings; dynamic routes are builder functions.
 */
export const ROUTES = {
  home: "/",
  shop: "/shop",
  cart: "/cart",
  checkout: "/checkout",
  account: "/account",
  accountOrders: "/account/orders",
  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  resetPassword: "/account/reset-password",
  authCallback: "/auth/callback",
  shipping: "/shipping",
  /** Tracking = order history now that checkout is sign-in only. */
  track: "/account/orders",
  care: "/care",
  contact: "/contact",
  about: "/about",
  faq: "/faq",
  /** Category listing — bare slug at the storefront root. */
  category: (slug: string) => `/${slug}`,
  /** Product detail page. */
  product: (slug: string) => `/product/${slug}`,
  /** Order confirmation — keyed on the order number (carries a random suffix). */
  order: (orderNo: string) => `/order/${encodeURIComponent(orderNo)}`,
} as const;

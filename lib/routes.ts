import type { PrintDoc } from "@/lib/admin/print"

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
  privacy: "/privacy",
  terms: "/terms",
  refundPolicy: "/refund-policy",
  /** Category listing — bare slug at the storefront root. */
  category: (slug: string) => `/${slug}`,
  /** Product detail page. */
  product: (slug: string) => `/product/${slug}`,
  /** Order confirmation — keyed on the order number (carries a random suffix). */
  order: (orderNo: string) => `/order/${encodeURIComponent(orderNo)}`,
  /** Signed-in order detail (items/address/status + cancel-while-Pending). */
  accountOrder: (orderNo: string) => `/account/orders/${encodeURIComponent(orderNo)}`,

  /**
   * Admin console (Phase 3) — the prototype's `sc-if` view switches become real
   * routes under the `(admin)` group. Kept together so the whole console can be
   * re-namespaced from one place.
   */
  admin: "/admin",
  adminOrders: "/admin/orders",
  /**
   * Print surface for one order (5.12) — chrome-free `(print)` group. Invoice
   * and packing slip are separate documents on the same route, picked by `?doc=`
   * (invoice is the default and carries no param).
   */
  adminOrderPrint: (orderNo: string, doc: PrintDoc = "invoice") =>
    `/admin/orders/${encodeURIComponent(orderNo)}/print${doc === "invoice" ? "" : `?doc=${doc}`}`,
  adminProducts: "/admin/products",
  adminAnalytics: "/admin/analytics",
  adminCategories: "/admin/categories",
  adminCoupons: "/admin/coupons",
  adminReviews: "/admin/reviews",
  adminMessages: "/admin/messages",
  adminSubscribers: "/admin/subscribers",
  adminEmails: "/admin/emails",
  adminSettings: "/admin/settings",
  adminTeam: "/admin/team",
  /** Admin auth — the ungated `(auth)` group, outside the console gate. */
  adminSignIn: "/admin/sign-in",
  adminForgotPassword: "/admin/forgot-password",
  adminResetPassword: "/admin/reset-password",
} as const

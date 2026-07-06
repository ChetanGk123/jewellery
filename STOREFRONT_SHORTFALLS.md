# Storefront Shortfalls & Production-Readiness Audit

Audit of the customer storefront as of **2026-07-05** (post-Phase 3.11 — full
admin console, coupons table, settings-driven shipping, subscribers, contact
messages all shipped). Method: full code review of `app/(storefront)` +
`components/storefront` + `lib` + migrations, **and** a live browser pass
(desktop 1440 / mobile 375) over home, `/shop`, product detail, cart, checkout,
My Orders, and error paths. Companion to `TASKS.md` (build tracker) and
`ARCHITECTURE_PLAN.md` (spec). Supersedes the 2026-07-03 audit — items it
listed that are now **fixed** are noted at the end.

## Verdict: NOT production-ready yet

The engineering core is genuinely solid (see "What's already strong" below),
but as a **customer-facing ecommerce store** it fails on merchandising, legal,
and lifecycle-communication basics. Six blockers below would each hurt a real
customer or the operator in week one. Estimated distance to a credible soft
launch: the blockers list, most of which are content/config rather than deep
engineering.

---

## Updates since this audit (Phase 4 work-in-progress)

- **1.4 fixed** — footer no longer claims UPI/Cards/Netbanking/Razorpay on a COD-only store.
- **1.3 partially fixed** — confirmation-page copy no longer claims an email was sent (real provider still not wired).
- **1.5 fixed** — Privacy Policy, Terms of Use, and Cancellation & Refund Policy pages added and linked from the footer.
- **1.6 fixed** — branded 404/error pages at both the storefront and root levels, plus loading skeletons for listing/product routes.
- **1.2 fixed** — `place_order` now checks and decrements `product.stock` (row-locked against overselling); admin cancel restores it. Storefront UI shows a disabled "Sold Out"/"Out of Stock" state.
- **New finding, fixed in the same migration:** while rewriting `place_order` for stock enforcement, found that its `auth.uid()` gate and `user_id` stamping (added in `0004_customer_auth.sql`) had been silently dropped by the `0012_admin_coupons.sql` coupon-table rewrite, undetected through `0013`/`0018`. `execute` was never re-granted to `anon`, so this was never an anonymous-write hole — but authenticated customers' orders since 0012 weren't tagged to their account (`user_id = null`), which would have made "My Orders" silently incomplete for any non-admin customer. Restored. See `TASKS.md` 4.4 for the full verification trail.
- **2.1 fixed** — mobile header now collapses the 7-item nav into a hamburger drawer ≤`md`; the hero renders in the first viewport at 375 instead of below a 4-row-wrapped nav strip. See `TASKS.md` 4.7 for the `backdrop-filter` containing-block bug found and fixed during verification.

See `TASKS.md` Phase 4 for the complete task-by-task breakdown and status.

---

## 1. Launch blockers

| # | Shortfall | Evidence | Fix direction |
|---|-----------|----------|---------------|
| 1.1 | **Placeholder imagery everywhere** | Every product/category card renders a seed gradient; the product gallery literally shows "PRODUCT IMAGE — YOUR PHOTO HERE"; the home hero card says "YOUR PHOTO HERE". A jewellery store cannot sell on gradients. | Source real photos, upload via the admin product modal (Storage pipeline already works), `primary_image_url` auto-fills. |
| 1.2 | **No stock enforcement at checkout** | `place_order` (latest def in `0018_admin_settings.sql`) rejects only `Draft` products — it never checks or decrements `product.stock`. The storefront UI never reads `stock` at all (no "out of stock" state, Add to Cart always enabled). Admin low-stock alerts track a number nothing enforces → overselling is guaranteed once stock matters. | Add a stock check + atomic decrement in `place_order`; release on cancel (mirror the coupon-use release); surface "Out of stock" on card/buy-box and disable Add. |
| 1.3 | **Order-confirmation email is a lie — no email exists at all** | `OrderConfirmation.tsx:44` renders "A confirmation has been sent to {email}" but no provider (Resend etc.) is wired; customers get nothing at any order stage (placed/shipped/delivered). For COD, the confirmation email is the only artifact the buyer holds. | Wire a provider + transactional template, or (interim) soften the copy to "Save your order number". |
| 1.4 | **False payment claims in the footer** | `Footer.tsx:74`: "UPI · Cards · Netbanking · COD · Razorpay Secured" — the store is COD-only; Razorpay is deferred. This is a trust-destroying misrepresentation (and arguably a legal one). | Change strip to "Cash on Delivery · GST registered · Made in India" until payments land. |
| 1.5 | **No legal pages** | No Privacy Policy, Terms of Use, or Cancellation/Refund policy routes exist anywhere (`lib/routes.ts`, `lib/navigation.ts`, help content — zero matches). India's Consumer Protection (E-Commerce) Rules 2020 require return/refund/exchange terms, seller details, and a grievance-redressal contact; collecting emails/addresses without a privacy policy is its own exposure. | Author 3 pages in the existing `lib/help-content.ts` pattern, link from footer. |
| 1.6 | **Broken default 404 / no error boundaries** | Zero `not-found.tsx`, `error.tsx`, `global-error.tsx`, or `loading.tsx` files in the app. A bad URL renders Next's default 404 as a giant **black** panel inside the cream storefront chrome with no footer (browser-verified) — looks like the site crashed. Any runtime error → unstyled default too. | Add branded `not-found.tsx` + `error.tsx` at the `(storefront)` (and root) level; `loading.tsx` skeletons for listing/product routes. |

## 2. High — hurts mobile shoppers and discovery

| # | Shortfall | Evidence | Fix direction |
|---|-----------|----------|---------------|
| 2.1 | **Mobile header has no menu — nav eats the first viewport** | At 375px the 7-item nav wraps into 4 stacked rows; announcement + brand + search + account/cart + nav ≈ the whole first screen. The hero (and any product) starts below the fold. Most Indian ecommerce traffic is mobile. | Collapse nav into a hamburger drawer ≤`md` (the admin console already has this pattern in `AdminShell`). |
| 2.2 | **Mobile `/shop` buries products under the full filter stack** | Browser-measured: first product card starts at **y≈1471px** (~2 viewports of category list + materials + price slider) before a single product is visible. | Collapse `FilterSidebar` into a "Filter & sort" disclosure/drawer on mobile. |
| 2.3 | **Card badge collision at mobile widths** | On narrow cards the "BESTSELLER"/"BRIDAL EDIT" badge and the "29% OFF" flag overlap and truncate (browser-verified at 375). | Stack or hide one at small widths. |
| 2.4 | **No SEO surface at all** | No `sitemap.ts`, no `robots.ts`, no `metadataBase`/canonical, no OpenGraph/Twitter images, no Product/Organization JSON-LD (zero matches repo-wide). Social shares render bare links; Google gets no product feed signals. | Add the four Next metadata surfaces; JSON-LD on product pages. |
| 2.5 | **No customer order detail or tracking** | My Orders is a list only — rows aren't clickable; no items/address/status timeline per order; footer "Track Order" just points at the list. Customers can't cancel a COD order either (admin-only) — for COD, cancellation requests will hit WhatsApp/phone instead. | Order detail page under `/account/orders/[orderNo]` reusing the confirmation RPC pattern; customer cancel-while-Pending action. |
| 2.6 | **Customers cannot write reviews** | `ProductReviews` renders approved rows; no submission form exists — the moderation console (3.7) moderates rows that can only appear by hand/seed. | Signed-in review form → `pending` → existing moderation queue. |
| 2.7 | **Every route is force-dynamic with zero caching** | The nonce CSP makes the root layout read headers per-request; combined with no `loading.tsx`, every nav blocks on a full server render (felt as dead clicks). CWV/bundle budgets in the repo rules are unverified; no Lighthouse pass has been run. | Performance pass (planned ⬜ in TASKS): evaluate static + hashed-CSP or per-route caching, add loading skeletons, run Lighthouse. |

## 3. Medium — operator pain / scale debt

| # | Shortfall | Evidence |
|---|-----------|----------|
| 3.1 | **No pagination on `/shop` or category pages** | `getProducts` supports `limit`/`range` but listing pages never pass one; the whole catalog renders in one unbounded query. Fine at 12 products, degrades as the catalog grows. |
| 3.2 | **Rate limiting covers only the newsletter** | `checkRateLimit` is used solely in `subscribe-action.ts`. Checkout (`place_order`) and contact (`submit_contact_message`) are anon-callable RPCs guarded by honeypot only; a script can flood orders/tickets. (In-memory limiter is also per-instance — swap for an edge store at deploy.) |
| 3.3 | **No lifecycle emails beyond the missing confirmation** | No shipped/delivered notices, no admin new-order alert; the operator must poll the console. |
| 3.4 | **COD toggle isn't enforced** | `setting.cod_enabled` persists but checkout ignores it (known 3.11 follow-up; harmless while COD is the only tender, a trap once payments land). |
| 3.5 | **Sign-in-only checkout** | Deliberate 2.8 decision, but it remains the single biggest conversion tradeoff in the funnel; revisit with real traffic data. |
| 3.6 | **Zero observability** | No error tracking (Sentry), no analytics (GA/Plausible), no uptime check. A production incident would be invisible. |
| 3.7 | **E2E suite writes to the production Supabase** | Real orders tagged `e2e-test@example.com`, cleaned by hand; no staging/branch DB. Blocks CI. |

## 4. Deploy / config loose ends (unchanged from last audit)

- **Not deployed** — localhost only; Vercel step still ⏸️ (or the Docker image — both exist, neither is live). Production env vars, domain, HTTPS unverified.
- **Google OAuth button ships dead** until the provider is enabled in the Supabase dashboard (client ID/secret + redirect URLs).
- **Branded auth email templates not applied** — `supabase/templates/apply.sh` never run; project sends bare defaults.
- **Supabase Site URL / redirect allowlist** still points at localhost.

## 5. Low / polish

- Home "Bestselling" (5 items) and "New Arrivals" (5 items) wrap 4+1, leaving a lonely orphan card row at 1440.
- Input placeholder contrast ~2.6:1 (accepted earlier — fields carry `aria-label`s).
- Active coupon codes are listed to the client for the cart preview — fine for advertised codes, wrong if a private code is ever created.
- No brand OG/social image beyond the default `favicon.ico`.

---

## What's already strong (don't re-litigate)

- **Write-path security**: all writes go through SECURITY DEFINER RPCs; tables RLS-sealed; totals recomputed server-side (client never sends prices); coupon consumption is atomic + released on cancel; order numbers carry an unguessable suffix.
- **Headers/CSP**: per-request nonce CSP with `strict-dynamic`, HSTS, frame-deny, etc. — zero console/CSP violations in the browser pass.
- **Auth**: password + OTP + OAuth code paths, PKCE callback with open-redirect guard, admin gate as a tamper-proof JWT claim, two-layer console protection.
- **Domain logic tested**: 86 unit tests green (cart/coupons/shipping/checkout/order mapping ≈100% line coverage), Playwright checkout journey + 20 visual baselines.
- **Single-source registries**: routes/nav/theme/store-info/settings — the coupon & shipping duplication from the last audit is gone (table + `setting` driven).
- **Admin console**: 10 working views covering orders, products (with image upload), categories, coupons, reviews, messages, subscribers, analytics, settings.

## Fixed since the 2026-07-03 audit

Newsletter form now saves (3.9) · Contact form now submits with ticket + admin
queue (3.8) · Coupon logic table-driven, drift risk gone (3.6) · Shipping rates
read from `setting` (3.11) · Stock *field* + admin alerts exist (3.4 —
enforcement still missing, see 1.2).

## Recommended order of attack

1. **Truth & legal (days):** footer payment strip (1.4), confirmation-email copy or a real provider (1.3), legal pages (1.5), branded 404/error pages (1.6).
2. **Sell honestly (blocking on content):** real product photography (1.1) + stock enforcement in `place_order` and the UI (1.2).
3. **Mobile funnel (1–2 days):** hamburger nav (2.1), mobile filter drawer (2.2), badge collision (2.3).
4. **Deploy hygiene:** Vercel/Docker deploy + env + domain, OAuth enable, apply email templates, staging DB for E2E, rate-limit checkout/contact via an edge store, add Sentry + analytics.
5. **Post-launch fast follows:** order detail + customer cancel (2.5), review submission (2.6), SEO surface (2.4), pagination (3.1), performance/caching pass (2.7).

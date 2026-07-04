# Storefront Shortfalls

Audit of gaps in the customer storefront as of **2026-07-03** (post-2.8c —
auth, cart, COD checkout and branded auth emails all shipped). Companion to
`TASKS.md` (the build tracker) and `ARCHITECTURE_PLAN.md` (the spec); most
items map to a planned Phase 3 / cross-cutting task, noted inline. Ordered by
how much each hurts.

## 1. Broken promises in the UI

The app currently *says* things that aren't true — worst category because a
real customer notices.

| # | Shortfall | Detail | Planned fix |
|---|-----------|--------|-------------|
| 1.1 | **No order-confirmation email** | `OrderConfirmation` says "A confirmation has been sent to {email}" — nothing is ever sent; no email provider (e.g. Resend) is wired at all. Send it or soften the copy. | later phase (needs provider) |
| 1.2 | **Newsletter form is decorative** | Footer "Stay in touch" accepts an email and does nothing — no action, no `subscriber` table. | 3.9 |
| 1.3 | **Contact form is decorative** | `/contact` renders a full form with no endpoint; a customer who "sends" a message gets silence. | 3.8 |

## 2. Commerce gaps (lose orders / create bad orders)

| # | Shortfall | Detail | Planned fix |
|---|-----------|--------|-------------|
| 2.1 | **No stock/inventory concept** | Nothing prevents ordering an out-of-stock product; there is no stock truth anywhere. | 3.4 (adds `stock`) |
| 2.2 | **No pagination on `/shop` / category pages** | DAL supports `limit`/`range` but listing pages never pass one — the grid renders the whole catalog in one unbounded query. Fine at seed size, degrades with growth. | unplanned |
| 2.3 | **Sign-in-only checkout** | Deliberate (2.8 decision), but the biggest conversion tradeoff in the funnel; revisit with real traffic. | decision, not defect |
| 2.4 | **No per-order tracking** | "Track Order" = the order list; no order detail view, no status timeline, no AWB (Shiprocket deferred). Status chips are all a customer gets. | 3.3 + Shiprocket phase |
| 2.5 | **Reviews are read-only** | Approved reviews render, but customers cannot submit one — `review` rows only exist by hand. | unplanned (3.7 is moderation only) |
| 2.6 | **Placeholder imagery** | Products render seed gradients, not photos (`product_image.url` empty → `primary_image_url` NULL). A jewellery store can't sell on gradients. | open question in TASKS |

## 3. Technical debt / risk

| # | Shortfall | Detail | Planned fix |
|---|-----------|--------|-------------|
| 3.1 | **Coupon logic duplicated in two languages** | `BRIDE20` lives in `lib/coupons.ts` *and* inside the SQL `place_order` function; changing one without the other silently breaks totals. | 3.6 (coupon table) |
| 3.2 | **Shipping constants duplicated** | ₹79 flat + free-ship threshold hardcoded in `lib/shipping.ts` and in SQL rather than read from `setting`. | 3.11 |
| 3.3 | **Zero caching — every route force-dynamic** | The nonce CSP requires per-request rendering, so even static pages (About/FAQ/Care) render on every hit. CWV/bundle budgets unverified. | Performance pass (⬜) |
| 3.4 | **No rate limiting** | Checkout has only a honeypot; `place_order` RPC and auth endpoints can be hammered. Needs an edge store (e.g. Upstash). | at deploy |
| 3.5 | **No SEO surface** | No `sitemap.ts`, no `robots.ts`, no Product/Organization JSON-LD, no OG images — a whole missing layer for a retail site. | unplanned |
| 3.6 | **E2E writes to production Supabase** | Tests place real orders in the live project (cleaned manually); no staging/branch DB. Firefox/WebKit projects not installed. | at deploy |

## 4. Config / deploy loose ends

| # | Shortfall | Detail |
|---|-----------|--------|
| 4.1 | **Not deployed** — localhost only; Vercel step is ⏸️. |
| 4.2 | **Google OAuth button ships dead** until the provider is enabled in the Supabase dashboard (client ID/secret + Site/Redirect URLs). |
| 4.3 | **Branded email templates not applied** — in the repo (`supabase/templates/`) but the project sends bare defaults until `apply.sh` runs or a dashboard paste. |
| 4.4 | **Minor a11y:** input placeholder contrast ~2.6:1 (accepted — fields have `aria-label`s). About/FAQ reachable only by URL, absent from nav. |

## Top three to act on

1. **Wire or remove the dead forms** (1.2, 1.3) and **fix the
   confirmation-email fib** (1.1) — a real customer hits these in week one.
2. **Pagination + stock guard** (2.1, 2.2) — correctness of the core shopping
   loop as the catalog grows.
3. **De-duplicate coupon/shipping rules and add rate limiting** (3.1, 3.2,
   3.4) — the items most likely to bite the operator rather than the customer.

# JR Jewellers — Build Task Tracker

Shared checklist for the Next.js rebuild. **Companion to `ARCHITECTURE_PLAN.md`** (the spec)
and `CLAUDE.md` (repo guide). We take these **one at a time, top to bottom**.

**Status legend:** ⬜ todo · 🟡 in progress · ✅ done · ⏸️ deferred

## Ground truth (as scaffolded)
- **Stack:** Next.js `16.2.9` (App Router) · React `19` · Tailwind `v4` · TypeScript · **Bun** (`bun.lock`).
- **Layout:** app lives at **root `app/`** (not `src/` — decided override of plan §4). Path alias `@/*` → `./*`.
  **Single-source-of-truth registries** (no per-file link/value duplication): `lib/routes.ts` (`ROUTES` — every URL + `category(slug)`/`product(slug)` builders; change a scheme here only), `lib/navigation.ts` (`PRIMARY_NAV`, `FOOTER_SHOP_LINKS`, `FOOTER_HELP_LINKS` built from `ROUTES`), `lib/theme.ts` (`PLACEHOLDER_GRADIENT`). All link/href usages go through these.
  Follows ARCHITECTURE_PLAN §4 otherwise: routes under **`app/(storefront)/`** (group scopes the customer Header/Footer + settings fetch via `(storefront)/layout.tsx`; admin gets its own group in Phase 3); category is the **bare `[category]` segment** → `/{slug}` URLs (plan §4; note: bare slugs share the root namespace with static routes like `/shop`, `/cart` — Next resolves static before dynamic). Components grouped **by surface**: `components/storefront/{layout,product,home}` (+ `ui/`, `admin/` when needed). `stores/`, `styles/` split deferred (YAGNI); `db/` is Supabase (`lib/db`), not Prisma.
- **Backend:** Supabase project `jr-jewellers` (`naolegptozpaiojozzcy`, ap-south-1). Schema + seed
  already applied; storefront tables are **RLS public-read**. Env in `.env.local`.
- ⚠️ **Next 16 has breaking changes** — read `node_modules/next/dist/docs/` before writing route/server code (per `AGENTS.md`).
- **Scope rules:** storefront-first · **COD-only for v1** · Razorpay/Shiprocket deferred.

---

## Phase 0.0 — DB hardening ✅ done
Migration `storefront_scale_hardening` applied & verified. Production-readiness for reads/writes at scale:
- ✅ `updated_at` + auto-update triggers on `product`, `product_image`.
- ✅ CHECK constraints on `product.status`, `product.badge`, `review.status` (protects partial indexes from typos).
- ✅ One-primary-image guarantee (`product_image_one_primary` partial unique index) + dedup.
- ✅ Denormalized `product.primary_image_url` + auto-sync trigger (join-free listing reads). *Currently NULL — seed images are gradient placeholders (`bg`), `url` not set; populates automatically once real photo URLs land.*
- ✅ Denormalized `rating`/`review_count` kept honest via `review`-change trigger.
- ✅ Full-text search: generated `product.search` tsvector + GIN index (replaces slow `ILIKE`).
- ✅ Query-pattern partial indexes: `product_active_by_cat`, `product_featured_idx`.
- Deferred (YAGNI): keyset pagination is a query change (indexes ready); `order`/`order_item` indexing → design in Phase 2; partitioning/replicas → not until ~100k+ rows.

## Phase 0 — Foundation & cleanup
Goal: a clean, branded shell wired to Supabase. No product pages yet.

- ✅ **0.1 — Strip scaffold leftovers.** Renamed package → `jr-jewellers`; deleted `CLAUDE copy.md`, `.DS_Store`, 5 sample SVGs; minimal placeholder `app/page.tsx`. *(Default `layout.tsx` metadata handled in 0.5.)*
- ✅ **0.2 — Folder convention.** Root `app/` + `lib/db`, `lib/utils`, `components/{ui,product,layout}` (alias `@/*`).
- ✅ **0.3 — `git init` + baseline commit.** On `main`; `.env.local`/`node_modules`/`.next` confirmed excluded. Commit `3ce9c46`.
- ✅ **0.4 — Brand design tokens.** `app/globals.css` rewritten: maroon/gold/cream palette, `--font-*`, sharp radii via Tailwind v4 `@theme`; forced dark mode removed.
- ✅ **0.5 — Fonts.** Marcellus/Cormorant Garamond/Jost via `next/font/google`, CSS vars wired; real metadata set. **Build verified green** (Next 16 + Turbopack).
- ✅ **0.6 — Supabase client.** `lib/db/client.ts` (browser singleton) + `lib/db/server.ts` (server factory, no session) + `lib/env.ts` (zod-validated public env).
- ✅ **0.7 — Generated DB types.** `lib/db/types.ts` from live schema (7 tables incl. `primary_image_url`, `search`, `updated_at`); clients typed `<Database>`.
- ✅ **0.8 — Money utils.** `lib/utils/money.ts` (`formatPaise`, `paiseToRupees`, `discountPercent`) + `money.test.ts` — **4/4 pass via `bun test`**.
- ✅ **0.9 — App shell.** `Header` (maroon announcement bar + cream brand row, nav, cart stub) + `Footer` wired into `layout.tsx`; semantic landmarks. **Build green.** *(Reconcile visuals against storefront prototype — see note below.)*

## Phase 1 — Storefront (read-only)
Goal: browse catalog end-to-end from real Supabase data. No cart writes yet.

- ✅ **1.1 — Data access layer.** `lib/db/queries.ts`: `getCategories`, `getProducts(filters)`, `getProductBySlug`, `getFeaturedProducts`, `getApprovedReviews`. Typed, server-side; visible = all statuses except `Draft`; filters (category slug/material/price/search/featured) + sort + pagination; primary-image resolver with gradient (`bg`) fallback. **Query shapes smoke-tested against live Supabase** (embeds, inner-join filter, full-text search, detail).
- ✅ **1.1b — App shell visual reconciliation.** `Header` + `Footer` rebuilt to match the storefront prototype (decoded DSL + browser-rendered both): gradient announcement bar w/ offer+code (scrolls; only brand row + nav stick), left two-line brand lockup, centre search form, Account + Cart-with-badge, centred 7-item nav w/ gold underline hover; footer gains brand blurb + socials, Shop/Help columns, newsletter (UI-only), payments/GST strip. **Verified 1440 + 375** (flex-wrap responsive, no overflow). Closes the 0.9 follow-up note. *Announcement copy is static — wire to `setting.banner` in 1.3.*
- ✅ **1.2 — `ProductCard`.** `components/product/ProductCard.tsx` — prototype-matched: square image (real photo, else seed gradient + engraved motif), corner badge + sale flag, category eyebrow, serif name, ₹ price + struck MRP, ★ rating, Add stub. Whole card is a stretched-link to `/product/[slug]`; lift + shadow on hover, focus-visible on the name. **Rendered vs prototype at 4-across** (grid tiles, prices/strikes correct). *Note: Tailwind v4 didn't tile the `auto-fill` arbitrary grid — use explicit responsive `grid-cols-*` in 1.3/1.4. Add button wires to cart in Phase 2.*
- ✅ **1.3 — Home page.** `app/page.tsx` (async server component) composes `components/home/*`: `Hero`, `TrustStrip`, `CategoryTiles`, `ProductSection` (reused for bestsellers + new arrivals), `PromoBanner`, `StoryBlock` — all prototype-matched (decoded DSL + browser-rendered @1440 & @375). Wired to real Supabase data via new/extended DAL: `getCategoryTiles` (categories + visible-product count, from `category.hero_bg`), `getFeaturedProducts(8)`, new `getFreshProducts(8)` (`is_fresh` filter added to `getProducts`), and new `lib/db/settings.ts` `getStoreSettings` (typed `banner`/`homepage_promo` merged over defaults). Header announcement now data-driven from `setting.banner` (via `layout.tsx`), closing the 1.1b follow-up. **tsc clean; home renders 200 with live products; grids use explicit responsive `grid-cols-*`.** *Add buttons still stub → cart in Phase 2.*
- ✅ **1.4 — Category page.** `app/(storefront)/[category]/page.tsx` (bare-slug route per plan §4 → `/{slug}`): breadcrumb, title + product count, `ProductCard` grid, empty-collection state, and `generateMetadata` (name/description). Unknown slug → `notFound()` (verified **HTTP 404**); valid slug renders live products (verified 200 + browser @1440). New `getCategoryBySlug`; grid uses `getProducts({categorySlug})`. *Sort control + filter sidebar deferred to 1.6 (URL search-param state).* **Structure aligned to ARCHITECTURE_PLAN §4** — see ground-truth note above (`(storefront)` group + `components/storefront/*`).
- ✅ **1.5 — Product detail.** `app/(storefront)/product/[slug]/page.tsx` (server) composes `components/storefront/product/*`: `ProductGallery` (client — selectable thumbnails, gradient+motif fallback), `ProductBuyBox` (client — plating-tone selector, qty stepper, Add-to-Cart/WhatsApp **stubs** per Phase 2 scope), `ProductTabs` (client — Description/Details/Shipping, ARIA tablist), `ProductReviews` + shared `StarRating` (presentational). Prototype-matched (decoded DSL + browser-rendered @1440 & @375): breadcrumb (Home / Category / product), gallery+info split, price/struck-MRP/off badge, trust strip (free-ship threshold from `getStoreSettings`), reviews grid w/ empty state, "You may also love" rail via new `getRelatedProducts` (same category, current excluded). `generateMetadata` (name + blurb). Unknown slug → `notFound()` (**verified HTTP 404**); valid slug **200 + build green**. *Add/WhatsApp wire up in Phase 2; sort/filter still 1.6.*
- ✅ **1.6 — Search & filter.** All filter/sort state lives in **URL search params** (`sort`/`material`/`maxPrice`/`q`) via new `lib/listing.ts` (`parseListingParams`, price bounds). New **`/shop`** route = full catalog + search landing (header search form already POSTs `?q=` here); `/[category]` reworked to the same shared surface. Shared `components/storefront/listing/*`: `ProductListing` (server — title/count/sort header + two-column facets·grid + filtered empty state), `SortSelect` (client — Featured/price/rating), `FilterSidebar` (client — category nav w/ counts, material toggles, max-price slider committing on release, Clear all). DAL: new `getMaterials` (distinct); reuses `getCategoryTiles` for facet counts. Prototype-matched + **browser-verified @1440** (Kundan facet → 4 results); search `?q=jhumka` → "2 results"; **build green**. *Filters are single-select material + max-price for v1 (multi-select/min-price deferred, YAGNI).*
- ✅ **1.7 — Static/help pages.** Five routes under `app/(storefront)/`: `/shipping` (Shipping & Returns), `/care` (Care Guide), `/contact`, `/about`, `/faq`. Copy + content centralized in `lib/help-content.ts`; shared presentational primitives in `components/storefront/help/` — `HelpHeader` (maroon-gradient hero + breadcrumb), `HelpBlocks` (`HelpSection`/`IconCard`/`NumberCard`/`NumberedSteps`/`CheckList`/`RatesTable`), and `ContactForm` (client, UI-only — no endpoint yet). Shipping/Care/Contact **prototype-matched** (decoded DSL + browser-rendered); About/FAQ have no prototype so authored to brand voice in the same visual language (FAQ uses native `<details>` disclosures — a11y, no client JS). `generateMetadata`/`metadata` per page. `ROUTES.about`/`ROUTES.faq` added. **Build green; all 5 render 200; browser-verified @1440 + @375 (no overflow); no console errors.** *Contact/newsletter forms wire to a real handler in a later phase; footer nav still mirrors prototype (Shipping/Track/Care/Contact) — About & FAQ reachable by URL, surface in nav later if desired.*
- ✅ **1.8 — Responsive + a11y + visual pass.** Swept every storefront route (home, `/shop`, `/[category]`, `/product/[slug]`, all 5 help pages) with a scripted horizontal-overflow detector under CDP device emulation (Chrome window-min clamps `resize` to ~500px, so `emulate` is required for true 320). **Fixed a shared overflow bug:** two-column blocks used `min-w-[300px]`/`min-w-[280px]` on flex children — a hard floor that overflows at 320 (272px available) regardless of `flex-wrap`, expanding the mobile viewport by ~28px. Reworked to **stack full-width on mobile, restore the two-column `min-w`/`flex-1` layout at `md:`** in `Hero`, `ProductGallery`, product page info column, and `/contact` (wrapper + both columns). **Verified no horizontal overflow at 320/375/768/1024/1440** (docScrollW ≤ viewport on every page; two-column layouts confirmed `flex-direction: row` at ≥`md`). **a11y:** structural audit across home/product/contact/faq — single `h1` + ordered `h2`/`h3` hierarchy, all images/links/buttons have accessible names, all form inputs labelled (`aria-label`), landmarks (`header`/`nav`/`main`/`footer`) present, tabs expose `tablist`/`tab`/`tabpanel`, FAQ uses native `<details>`; keyboard focus preserved everywhere (native focus ring intact; the two `outline-none` inputs are compensated by wrapper `focus-within` borders, matching the `focus-visible:border-gold-400` pattern). **Contrast:** all core text passes AA comfortably (body 7.7–8.1, headings 13–17, footer 11.4, CTA 7.0); **fixed** gold-600 eyebrow labels (3.57 → AA-fail) by darkening the `--color-gold-600` token `#a87a1e → #94670f` (now 4.64:1 on cream-100), safe since gold-600 text only ever sits on light backgrounds. **tsc clean; build green (all 10 routes); no console errors.** *Known minor: input placeholders `#B79B7E` ≈ 2.62:1 — left as-is since every field has an `aria-label` (placeholder is a supplementary hint, not the accessible name) and darkening enough to pass would make it read like entered text.*

## Phase 2 — Cart & checkout (COD)
Goal: place a COD order. Introduces the first storefront **writes** (needs RLS insert policies).

- ✅ **2.1 — Cart store.** Split into a **pure domain core** + a **thin persisted store** (mirrors `lib/utils/money` — logic is testable without React). `lib/cart.ts`: `CartLine`/`CartLineInput` model (integer-paise **snapshots**, display-only — server recomputes at 2.5), immutable ops `addLine` (merges same product+variant, distinct variants stay separate lines, qty capped `MAX_LINE_QUANTITY=10`), `setLineQuantity` (clamps; ≤0 removes), `removeLine`, deterministic `cartLineId(productId, optionValue?)`, and derived selectors `cartCount`/`cartSubtotalPaise`/`cartMrpTotalPaise`/`cartSavingsPaise`. `stores/cart.ts` (`"use client"`): Zustand `useCartStore` wrapping those ops, `persist` → localStorage (`jr-cart` v1, `partialize` lines only) with a `hasHydrated` flag (set via `onRehydrateStorage`) so consumers render neutral until rehydrated (no SSR/CSR badge mismatch); actions `addItem`/`setItemQuantity`/`removeItem`/`clearCart`. **`bun test` 13/13 pass; tsc clean (cart code); build green (all 10 routes).** *UI wiring (buttons → store) is 2.2; the `bun:test` module tsc error on `*.test.ts` is pre-existing (Next build excludes tests).*
- ⬜ **2.2 — Cart UI.** Drawer/page: line items, qty controls, subtotal, free-ship threshold hint.
- ⬜ **2.3 — Coupons.** Apply/validate `BRIDE20`; show discount; guard invalid/expired.
- ⬜ **2.4 — Checkout form.** Address + COD, React Hook Form + zod; client **and** server validation.
- ⬜ **2.5 — Order creation.** Server action / route that writes `order` + `order_item`; add scoped RLS insert policies; integer-paise totals server-recomputed (never trust client).
- ⬜ **2.6 — Confirmation page.** Order summary + reference number.
- ⬜ **2.7 — WhatsApp enquiry.** Prefilled `wa.me` link from product/cart context.

## Phase 3 — Admin console *(deferred until storefront ships)*
- ⏸️ Auth (Supabase Auth, admin role) · Dashboard · Products CRUD · Orders · Reviews moderation · Settings.
  Uses **service-role key server-side only**.

## Cross-cutting (ongoing, not a phase)
- ✅ **Store info config (single source of truth).** New `lib/store-info.ts` — one typed `STORE_INFO` const holding the business's identity + contact details: `name`/`wordmark`/`descriptor`/`tagline`, `phone`/`whatsapp`/`email` (each with a display form **and** a derived `tel:`/`mailto:`/`wa.me` link built from one raw handle so they can't drift), `address`, `hours` (short/long/note), `gstin` (null until issued), and `socials` (`SocialLink[]`). Consumed by `Footer` (wordmark, tagline, socials — now render as real links when a URL exists; WhatsApp badge is a live `wa.me` link; copyright name), `Header` (wordmark + descriptor), and `lib/help-content.ts` (`CONTACT_CHANNELS` phone/email/WhatsApp/address + `SUPPORT_HOURS`). Value-parity refactor (same strings) + tel/mailto/wa.me now derived. **Kept as `const`, not env** (identical across environments; YAGNI — env layering trivial to add later); **distinct from** DB-backed editable copy (banner/promo/`store_name` via `getStoreSettings`). Marketing prose/metadata that merely *mentions* the name left inline (editorial, not a maintained detail). Feeds **2.7** (WhatsApp enquiry builds from `STORE_INFO.whatsapp.number`). **tsc clean; build green (all 10 routes).**
- ⬜ **Testing** — unit (utils/queries), component visual regression, E2E for browse→COD order (Playwright). Target 80%.
- ⬜ **Performance** — CWV budgets (LCP <2.5s), `next/image` dims, font preload, bundle budget.
- ⬜ **Security** — CSP/security headers, server-side input validation, no service-role key in client, form anti-abuse.
- ⏸️ **Deploy** — Vercel (project + env vars) once Phase 1 is reviewable.

---

### How we work this list
1. Pick the **top unchecked** task. 2. I implement it (small diff, mirrors plan/tokens). 3. Mark ✅, note any follow-ups. 4. Next.

### Open questions (decide as we hit them)
- **Product imagery:** seed `product_image` rows have NO `url` — only `design_name` + a CSS gradient `bg` (prototype rendered gradient cards, not photos). Decide: (a) ship gradient placeholders for v1 and render from `bg`, or (b) source real photos and populate `url` (then `primary_image_url` auto-fills). If (a), we may also denormalize `bg` onto `product` to keep listings join-free.
- Guest checkout only, or optional customer accounts in v1.
- Confirm Vercel as host (assumed).

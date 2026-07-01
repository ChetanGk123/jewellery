# JR Jewellers — Build Task Tracker

Shared checklist for the Next.js rebuild. **Companion to `ARCHITECTURE_PLAN.md`** (the spec)
and `CLAUDE.md` (repo guide). We take these **one at a time, top to bottom**.

**Status legend:** ⬜ todo · 🟡 in progress · ✅ done · ⏸️ deferred

## Ground truth (as scaffolded)
- **Stack:** Next.js `16.2.9` (App Router) · React `19` · Tailwind `v4` · TypeScript · **Bun** (`bun.lock`).
- **Layout:** app lives at **root `app/`** (not `src/`). Path alias `@/*` → `./*`.
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

- ⬜ **1.1 — Data access layer.** `lib/db/queries.ts`: `getCategories`, `getProducts(filters)`,
  `getProductBySlug`, `getFeaturedProducts`, `getApprovedReviews(productId)`. Typed, server-side.
- ⬜ **1.2 — `ProductCard`.** `components/product/ProductCard.tsx` — image, name, ₹ price + struck MRP, badge; designed hover/focus states.
- ⬜ **1.3 — Home page.** Hero/banner (from `setting.banner`), featured grid, category tiles, promo strip (`homepage_promo`).
- ⬜ **1.4 — Category page.** `app/(storefront)/category/[slug]/page.tsx` — header + product grid; 404 on unknown slug.
- ⬜ **1.5 — Product detail.** `app/(storefront)/product/[slug]/page.tsx` — gallery, options, price, long desc/details tabs, approved reviews. `generateMetadata` for SEO.
- ⬜ **1.6 — Search & filter.** Category/material/price filters + sort, all as **URL search-param state**.
- ⬜ **1.7 — Static/help pages.** About, Contact (form UI only), Shipping & Returns, Care, FAQ — mirror prototype copy.
- ⬜ **1.8 — Responsive + a11y + visual pass.** Verify 320/375/768/1024/1440, keyboard nav, contrast, no overflow.

## Phase 2 — Cart & checkout (COD)
Goal: place a COD order. Introduces the first storefront **writes** (needs RLS insert policies).

- ⬜ **2.1 — Cart store.** Zustand store + localStorage persistence; add/remove/qty; derived totals.
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

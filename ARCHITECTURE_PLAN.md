# JR Jewellers — Next.js Rebuild: Design & Architecture Plan

Plan to recreate the two bundled prototypes — **`JR Jewellers Storefront.html`**
(customer shop) and **`JR Admin Dashboard.html`** (admin console) — as a **single
Next.js application** with a real backend, replacing the static builder export.

> Source of truth for UI/flows: the decoded template DSL of both files. The
> prototypes are pixel-complete UI mockups with placeholder data; this plan turns
> them into a working full-stack app while preserving the exact look and feel.

> **Locked decisions (confirmed):**
> - **Backend:** Supabase (Postgres + Auth + Storage + RLS).
> - **v1 scope:** Storefront first — ship the customer shop, then build admin.
> - **Payments v1:** COD only. Razorpay is deferred to a later phase (schema and
>   checkout are built COD-ready now, gateway wired later).

---

## 1. Product summary (what the prototypes actually do)

**Brand:** JR Jewellers — artificial / imitation **bridal jewellery**, Indian
market, prices in **₹ (INR)**, COD + Razorpay, Shiprocket fulfilment, WhatsApp
enquiries.

### Storefront (customer) — 10 "pages" (currently `sc-if` view-switches)
- **Home** — announcement banner, hero ("The Bridal Edit · 2026"), trust strip,
  shop-by-category tiles, bestsellers, festive promo block, new arrivals, editorial.
- **Category / listing** — breadcrumb, sort (Featured / Price ↑ / Price ↓ / Top
  Rated), sidebar filters (category, material, price range slider), product grid,
  empty state.
- **Product detail** — gallery + thumbnails, price/MRP/discount, plating-tone
  selector, qty stepper, Add to Cart, **WhatsApp enquiry**, trust badges, tabs
  (Description / Details / Shipping), reviews, related products.
- **Cart** — line items w/ qty + remove, coupon entry, summary (subtotal,
  discount, shipping, total), empty state.
- **Checkout** — contact + shipping form (name, phone, email, address, city,
  state, pincode), payment method select (Razorpay UPI/cards, COD), order summary.
- **Order confirmation** — order no, amount, est. delivery.
- **Static/help pages** — Shipping & Returns, Track Order, Care Guide, Contact
  (with form).
- **Cart drawer** — slide-in mini-cart (global).
- **Component:** `ProductCard` (reused across home/category/related).

### Admin dashboard — 11 sections + overlays
- **Dashboard** — KPI cards (orders today, revenue today, pending, low/out of
  stock), 7-day revenue bar chart, recent orders, low-stock alerts, top sellers.
- **Orders** — status tabs w/ counts, paginated table, **order drawer** (status
  stepper, customer, line items, totals, **Shiprocket AWB generate / print label**,
  advance-status / cancel actions).
- **Products** — search + category/status filters, paginated table, **Add/Edit
  product modal** (name, SKU, multi-image/design manager w/ primary, category,
  material, badge, price, MRP, stock, descriptions), **Import CSV modal**.
- **Analytics** — product list + per-product detail view.
- **Categories** — CRUD via category modal.
- **Coupons & Offers** — CRUD via coupon modal (code, type, value, min order, expiry).
- **Reviews** — moderation queue (pending count badge).
- **Contact messages** — support inbox (pending ticket badge).
- **Newsletter subscribers** — list + search by email.
- **Settings** — store info (name, email, phone, GSTIN), shipping/payment
  toggles (free-ship threshold, flat rate, COD on/off, Razorpay live on/off),
  **live-preview announcement banner editor**, **live-preview homepage promo editor**.
- **Global overlays** — auth (sign in / forgot / reset sent), user menu,
  notifications panel, toast, mobile sidebar (collapsible/overlay).

---

## 2. Core domain model

Single source of truth shared by storefront + admin. Money stored as **integer
paise** (avoid float); dates **ISO-8601 (UTC)**; display formatting in the UI layer.

| Entity | Key fields |
|---|---|
| **Product** | id, name, slug, sku, categoryId, material, badge (None/Bestseller/New/Bridal Edit), pricePaise, mrpPaise, stock, status (Active/Low/Out/Draft), descShort, descLong, detailsPlating, detailsStones, detailsCare, shippingNote, rating, reviewCount, createdAt |
| **ProductImage** | id, productId, url, designName, isPrimary, sortOrder |
| **ProductOption** (plating tone) | id, productId, label (Gold/Silver/Rose), value |
| **Category** | id, name, slug, description, productCount (derived), heroBg |
| **Order** | id, orderNo (JR-…), customerId/guest, status (Pending→Confirmed→Packed→Shipped→Delivered / Cancelled), paymentMethod (Razorpay/COD), paymentStatus, subtotalPaise, discountPaise, shippingPaise, totalPaise, couponCode, awb, shiprocketShipmentId, createdAt |
| **OrderItem** | id, orderId, productId, name (snapshot), tone, qty, unitPricePaise, lineTotalPaise |
| **Address** | name, phone, email, line, city, state, pincode |
| **Coupon** | id, code, type (percent/flat), value, minOrderPaise, expiresAt, active, usageCount |
| **Review** | id, productId, name, rating, title, body, status (pending/approved/rejected), createdAt |
| **ContactMessage** | id, name, email, subject, body, status (new/replied/closed), createdAt |
| **Subscriber** | id, email, createdAt, source |
| **Setting** (singleton/k-v) | storeName, supportEmail, phone, gstin, freeShipThresholdPaise, flatRatePaise, codEnabled, razorpayLive, banner{enabled,msg1,msg2,offerLabel,offerText,code}, homepagePromo{enabled,eyebrow,title,code,note,button} |
| **AdminUser** | id, email, passwordHash, name, role |

The Settings `banner` and `homepagePromo` objects map **1:1** to the live-preview
editors in admin and are consumed by the storefront header/home — so editing in
admin changes the storefront ("Changes apply live").

---

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One app, two surfaces, RSC + route handlers for API |
| Styling | **Tailwind CSS** + CSS variables for design tokens | Prototypes are inline-style heavy; tokens centralize the maroon/gold palette |
| UI primitives | **shadcn/ui** (Radix) for modals, drawers, selects, toasts | Replaces hand-rolled overlays/steppers with accessible components |
| Fonts | `next/font` — Marcellus, Cormorant Garamond, Jost | Same three families already used |
| DB | **Supabase Postgres** (via Prisma or `supabase-js`) | Relational model above; one provider also gives auth + storage |
| Auth (admin) | **Supabase Auth** | Matches sign-in / forgot-password flow; deferred to admin phase |
| Images | Next/Image + **Supabase Storage** | Prototype has placeholders; admin "design manager" needs uploads |
| Payments | **COD only (v1)**; Razorpay (orders + webhook) deferred | v1 ships Cash on Delivery; gateway added later, schema is COD-ready |
| Shipping | **Shiprocket API** (create order, generate AWB, label, track) | Drawer already models AWB generate / print |
| Notifications | Email (Resend/SES) + **WhatsApp** (Cloud API / wa.me link) | Order updates + product enquiry |
| State (client) | **Zustand** for cart + URL state for filters/pagination | Cart drawer is global; filters belong in the URL |
| Data fetching | RSC + Server Actions; TanStack Query for admin tables | Server-first; admin tables need client interactivity |
| Validation | **Zod** shared client/server | Forms (checkout, product, coupon) |
| Charts | lightweight (Recharts) or keep CSS bars | Dashboard revenue chart is trivial bars |

> If you prefer minimal infra, the **Supabase** path (Postgres + Auth + Storage +
> RLS) collapses several rows above into one provider and is a good default.

---

## 4. Application architecture

Single Next.js app, **two route groups** sharing one design system and one DB:

```
src/app/
  (storefront)/                 # customer site — public, SSR/ISR
    layout.tsx                  # header, announcement banner, cart drawer, footer
    page.tsx                    # Home
    [category]/page.tsx         # Category listing (filters via searchParams)
    product/[slug]/page.tsx     # Product detail
    cart/page.tsx
    checkout/page.tsx
    order/[orderNo]/page.tsx    # Confirmation / track
    shipping/ care/ contact/ track/ page.tsx   # static help pages
  (admin)/admin/                # admin console — auth-gated
    layout.tsx                  # sidebar + topbar + overlays (notif, user menu, toast)
    page.tsx                    # Dashboard
    orders/page.tsx             # + order drawer (parallel/intercepting route or modal)
    products/page.tsx
    analytics/page.tsx  analytics/[id]/page.tsx
    categories/ coupons/ reviews/ messages/ subscribers/ settings/ page.tsx
    login/page.tsx
  api/                          # route handlers (or Server Actions)
    razorpay/order, razorpay/webhook
    shiprocket/awb, shiprocket/track
    revalidate (storefront cache bust on admin edits)
src/
  components/  (storefront/, admin/, ui/)   # ProductCard, KpiCard, DataTable, ...
  lib/         (db, auth, razorpay, shiprocket, money, format)
  stores/      (cart.ts)
  styles/      (tokens.css, globals.css)
  db/          (prisma schema, seed)
```

**Why two route groups, not two apps:** the prototypes are visually a single brand
and share fonts, palette, the Product entity, and the banner/promo settings link.
One app = one deploy, one DB client, shared types, atomic "admin edits → storefront
updates" via `revalidatePath`/`revalidateTag`.

---

## 5. Design system (extract from prototypes → tokens)

Centralize what is currently inline. Proposed CSS variables / Tailwind theme:

```
--maroon-900:#2A0A12  --maroon-800:#2A1115  --maroon-700:#4A0E1C
--maroon-600:#71182B  --maroon-550:#5E1322
--gold-400:#E6CA7E   --gold-500:#C9A24B   --gold-600:#A87A1E   --gold-700:#B58A3C
--cream-50:#FBF6EE    --cream-100:#FFFDF8  --cream-200:#F3E3C7  --paper:#FBF1E0
--ink:#2A1115  --muted:#7A655F  --line:#E7D9C2 / #EFE3D0
status: success #1B7A3D, warn #B7791F, danger #C0392F, info #2563A8
fonts: Marcellus (logo/display), 'Cormorant Garamond' (headings), Jost (UI/body)
radii: storefront 2–4px (sharp luxe), admin 8–12px (soft cards)
keyframes: jrFade, jrSlide, jrShimmer, adFade, adGrow
```

Build a small primitive set mirroring the mockups: `Button` (gold-gradient
primary, maroon solid, outline), `Badge`/`StatusPill`, `Card`, `Drawer`,
`Modal`, `Toast`, `Stepper`, `DataTable`, `Pagination`, `Toggle`, `RangeSlider`.

---

## 6. Key flows to implement (beyond static UI)

1. **Browse → filter/sort** — Category page reads `searchParams` (category,
   material, maxPrice, sort, page); query DB server-side; SSR/ISR.
2. **Cart** — Zustand store (persisted to localStorage) + cart drawer; line math
   in a shared `money` util.
3. **Coupon** — server validation against `Coupon` (active, min order, expiry).
4. **Checkout → pay** — validate (Zod) → create Order (Pending) → Razorpay order
   (or COD) → **webhook** confirms payment → Order=Confirmed → confirmation page +
   email/WhatsApp.
5. **Fulfilment (admin)** — order drawer advances status; **Generate AWB** calls
   Shiprocket, stores AWB; **Print Label** opens label; status stepper reflects state.
6. **Catalog management** — product modal create/edit incl. multi-image upload &
   primary selection; CSV import maps rows → Products.
7. **Live settings** — admin banner/promo editors write `Setting`; storefront
   reads it; `revalidateTag('settings')` so the change shows immediately.
8. **Admin auth** — Auth.js credentials; protect `(admin)` via middleware;
   forgot/reset email flow.
9. **Reviews / messages / subscribers** — moderation + inbox + list; badge counts
   feed the sidebar.

---

## 7. Phased roadmap (storefront-first, COD v1)

**v1 = storefront live with COD.** Admin and payment gateway follow.

- **Phase 0 — Foundation:** Next.js + TS + Tailwind, design tokens, fonts, UI
  primitives, **Supabase project**, schema + seed (port placeholder data from the
  prototypes). Order schema is built COD-ready (paymentMethod/paymentStatus exist).
- **Phase 1 — Storefront read-only:** layout (banner/header/footer), Home,
  Category (filters/sort), Product detail, ProductCard — wired to Supabase, no cart yet.
- **Phase 2 — Cart & COD checkout (v1 launch):** cart store + drawer, coupons,
  checkout form, **place order as COD** (no gateway), confirmation, order
  email/WhatsApp. Storefront can go live here.
- **Phase 3 — Admin core:** Supabase Auth + middleware, layout
  (sidebar/topbar/overlays), Dashboard, Orders + drawer, Products + modal/CSV,
  Categories. (Admin needed operationally once orders flow in.)
- **Phase 4 — Admin extended:** Coupons, Reviews, Messages, Subscribers,
  Analytics, Settings (live banner/promo → storefront).
- **Phase 5 — Payments + fulfilment:** **add Razorpay** (orders + webhook)
  alongside COD; Shiprocket (AWB/label/track); image uploads, search.
- **Phase 6 — Polish & launch hardening:** accessibility pass, SEO/metadata,
  ISR/caching, tests, env/secrets, deploy (Vercel), monitoring.

---

## 8. Decisions

**Confirmed:**
1. **Backend:** Supabase (Postgres + Auth + Storage + RLS).
2. **v1 scope:** Storefront first; admin follows in Phase 3+.
3. **Payments v1:** COD only; Razorpay deferred to Phase 5.

**Still open (don't block Phase 0–1):**
4. **Real product photography** available, or keep the SVG/gradient placeholders
   until images exist?
5. **Customer accounts** — guest-only checkout (as prototyped) or add login/order
   history?
6. **Hosting** target (Vercel assumed).
7. **ORM** — Prisma vs `supabase-js`/`postgres.js` directly (both work with Supabase).

---

### Appendix — working notes
- Prototypes are builder exports: each `.html` = bootstrap JS + gzip+base64
  manifest (shared React runtime + woff2 fonts) + JSON-encoded template DSL
  (`<x-dc>`, `<sc-if>`, `<sc-for>`, `<dc-import>`, `{{ binding }}`). All UI/flow
  intelligence above was extracted from the **template DSL**; the manifest is just
  the rendering engine and is **not** reused in the rebuild.
- Decoded sources (for reference while building) were written to the session
  scratchpad as `*__template.html` and `*__manifest.js`.

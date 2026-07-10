# Cashfree Payment Gateway — Implementation Guide

How to add prepaid online payments (UPI / cards / netbanking) to this app via
**Cashfree Payments**, alongside the existing COD flow. This is the design +
integration reference; when the work is scheduled it becomes a numbered phase
in `TASKS.md` (a suggested breakdown is in §11) and follows the release
process in [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md).

> Gateway decision context: Razorpay was the default recommendation
> (2026-07-10 discussion); the operator chose Cashfree (lower MDR — 1.95%
> standard / 1.6% intro, ₹4,999/yr AMC). This doc is written for Cashfree's
> **PG API version `2025-01-01`** — pin it explicitly (§4) and re-check the
> [API reference](https://www.cashfree.com/docs/api-reference/payments/latest/orders/create)
> when implementing.

---

## 0. Integration shape at a glance

Cashfree's model is a three-leg flow, which maps cleanly onto the existing
checkout:

```
 browser                      server                          Cashfree
 ───────                      ──────                          ────────
 submitCheckout ───────────▶ place_order RPC (recomputes ₹)
                             POST /pg/orders  ──────────────▶ creates CF order
                             ◀── payment_session_id ─────────
 ◀── payment_session_id ────
 cashfree.checkout(...) ────────────────────────────────────▶ hosted checkout
                                                              (UPI/card/NB)
 ◀────────────── redirect to /order/[orderNo] ───────────────
                             ◀── PAYMENT_SUCCESS_WEBHOOK ──── (source of truth)
                             verify HMAC → mark paid → email
```

Three invariants carried over from the COD design — **do not relax them**:

1. **The client never sends a price.** The Cashfree order is created
   server-side from the total the `place_order` RPC recomputed.
2. **The webhook is the only thing that marks an order paid.** The browser
   redirect/callback is UX, not truth — a user can close the tab after paying.
3. **All writes go through SECURITY DEFINER RPCs** (or the server-only admin
   client) — the anon key keeps zero write policies.

---

## 1. Prerequisites (operator, before any code)

- Cashfree merchant account + **KYC approved** for the business category
  (imitation jewellery — start early; jewellery-adjacent categories can get
  extra scrutiny). Note the ₹4,999/yr AMC on the standard plan.
- **Sandbox credentials** (App ID + Secret) from the merchant dashboard —
  available immediately, before KYC completes; production keys after.
- Webhook endpoint registered in the dashboard (per environment, §7.4).
- Staging environment live (`DEPLOYMENT_PLAN.md` §2) — payment flows are
  exercised on staging + sandbox keys first, never developed against prod.

## 2. Packages

| Where | Package | Purpose |
|---|---|---|
| Server | *(none — thin fetch client, §5)* | Create order, fetch payments, refunds |
| Browser | `@cashfreepayments/cashfree-js` | Loads checkout: `load({ mode })` → `cashfree.checkout(...)` |

The server side is deliberately **not** the [`cashfree-pg` SDK](https://www.npmjs.com/package/cashfree-pg):
we call three endpoints; the repo precedent is the Resend integration (4.6),
which wrapped one authenticated REST endpoint in a small typed module rather
than adopting an SDK. Revisit if the surface grows (payouts, splits).

## 3. The paise ↔ rupees trap (read this twice)

This app stores money as **integer paise**. Cashfree's `order_amount` is
**decimal rupees** (e.g. `1676.80`) — unlike Razorpay, which takes paise.
All conversion lives in one pure function, unit-tested, used nowhere-but-here:

```ts
// lib/payments/money.ts
/** 167680 (paise) -> "1676.80" (rupees string for Cashfree order_amount). */
export function paiseToRupeeString(paise: number): string {
  if (!Number.isSafeInteger(paise) || paise < 0) throw new Error(`bad paise: ${paise}`);
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}
```

Never `paise / 100` inline (float), never parse Cashfree's amounts back into
app state — the app's own paise totals remain authoritative everywhere.

## 4. Environment variables

Add to `.env.example`, the Dokploy panels (staging = sandbox keys, prod =
production keys), and CI E2E secrets as needed:

```bash
# Cashfree PG — server-only secrets; no NEXT_PUBLIC_* except the mode flag
CASHFREE_APP_ID=            # x-client-id
CASHFREE_SECRET_KEY=        # x-client-secret; ALSO the webhook HMAC key
CASHFREE_ENV=sandbox        # sandbox | production (selects API base URL)
NEXT_PUBLIC_CASHFREE_ENV=sandbox   # mode for the browser SDK's load()
```

- Base URLs: sandbox `https://sandbox.cashfree.com/pg`, production
  `https://api.cashfree.com/pg`.
- Pin `x-api-version: 2025-01-01` as a named constant in the client module.
- Like Resend: **no key ⇒ feature off** — `isOnlinePaymentEnabled()` mirrors
  `isEmailEnabled()`, checkout renders COD-only, nothing crashes.
- Storefront toggle: add `online_payments_enabled` to the `setting` singleton
  (admin Settings card, next to the existing COD toggle) so the operator can
  kill-switch prepaid without a redeploy.

## 5. Server: thin Cashfree client

`lib/payments/cashfree.ts` — `import "server-only"`, same posture as
`lib/email/send.ts` (timeouts, typed results, logs-never-leaks):

```ts
// Sketch — the real module validates responses with Zod at the boundary.
const BASE = env === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
const HEADERS = {
  "x-client-id": CASHFREE_APP_ID,
  "x-client-secret": CASHFREE_SECRET_KEY,
  "x-api-version": "2025-01-01",
  "Content-Type": "application/json",
};

export async function createCashfreeOrder(o: {
  orderNo: string;            // our JR-YYMMDD-#### — valid CF order_id charset
  totalPaise: number;
  customer: { id: string; name: string; phone: string; email: string };
}) {
  // POST /pg/orders
  // body: {
  //   order_id: o.orderNo,
  //   order_amount: paiseToRupeeString(o.totalPaise),  // decimal rupees!
  //   order_currency: "INR",
  //   customer_details: { customer_id, customer_name, customer_phone, customer_email },
  //   order_meta: {
  //     return_url: `${SITE_URL}/order/${o.orderNo}`,   // CF appends ?order_id=
  //     notify_url: `${SITE_URL}/api/webhooks/cashfree`, // belt & braces; dashboard config is primary
  //   },
  //   order_expiry_time: <ISO, now + 30 min>,           // bounds the unpaid window (§8)
  // }
  // -> { payment_session_id, cf_order_id, order_status: "ACTIVE", ... }
}

export async function getCashfreeOrderPayments(orderNo: string) {
  // GET /pg/orders/{order_id}/payments — reconciliation + webhook cross-check
}

export async function createCashfreeRefund(orderNo: string, amountPaise: number, refundId: string) {
  // POST /pg/orders/{order_id}/refunds — for Phase 8.7 returns; refundId = idempotency key
}
```

Our `order_no` doubles as the Cashfree `order_id` (alphanumeric + `-`/`_` is
allowed), so there is exactly one join key between the systems.

## 6. Checkout flow changes

### 6.1 Database (one migration)

- `order` table: add `cf_order_id text` and `paid_at timestamptz` (nullable).
  `payment_method` / `payment_status` columns already exist from Phase 2
  (COD-ready); extend their accepted values rather than inventing new columns.
- `place_order` RPC (new migration, successor to the current version): accept
  tender `ONLINE` in addition to COD. Online orders are created with
  `payment_status = 'unpaid'` and are **excluded from admin "new order"
  surfaces until paid** (they're intents, not orders yet). COD behavior is
  byte-for-byte unchanged.
- New SECURITY DEFINER `record_payment(p_order_no, p_cf_payment, ...)` RPC:
  flips `unpaid → paid`, stamps `paid_at` + gateway payment id, **idempotent**
  (a second call with the same payment id is a no-op returning the current
  state) — webhooks retry and arrive out of order by design. Deny-all RLS
  stays; only the webhook route (server, service key) calls it.

### 6.2 `submitCheckout` server action

Payment-method radio (COD | Pay online) joins the checkout form schema. For
`ONLINE`, after the existing `place_order` call succeeds:

1. `createCashfreeOrder({ orderNo, totalPaise: rpcResult.total_paise, customer })`.
2. Persist `cf_order_id` on the order row.
3. Return `{ ok: true, payment: { paymentSessionId } }` instead of the
   COD success shape.
4. **Do not queue the confirmation email here** for online orders — it moves
   to the webhook (§7.3). COD keeps the current post-RPC queue point.

If the Cashfree create-order call fails, the order row stays `unpaid` and the
user sees a retryable error; the expiry sweep (§8) reaps it if abandoned.

### 6.3 Client (`CheckoutForm` / `CheckoutView`)

```ts
import { load } from "@cashfreepayments/cashfree-js";

const cashfree = await load({ mode: process.env.NEXT_PUBLIC_CASHFREE_ENV });
await cashfree.checkout({ paymentSessionId, redirectTarget: "_self" });
```

`redirectTarget: "_self"` = full-page hosted checkout, then Cashfree
redirects back to `return_url` (`/order/[orderNo]`). Chosen over the iframe/
drop-in modes because it's the least CSP-entangled and mobile-UPI-friendly
(intent links open the UPI app directly). The cart is **not** cleared before
redirect; it clears when the confirmation page shows a paid/COD order.

### 6.4 Confirmation page `/order/[orderNo]`

Reads payment state **from our DB only** (never from `?order_id` query
params). Three renders: paid (current success panel + "payment received"),
`unpaid` ("confirming your payment…" + refresh affordance — covers the
webhook race, typically <5 s), failed/expired (retry payment or fall back to
COD). If state is `unpaid` on load, the page may call
`getCashfreeOrderPayments` server-side as an active reconcile — handles the
"webhook delayed but user is staring at the page" window.

## 7. Webhook — the payment source of truth

### 7.1 Route

`app/api/webhooks/cashfree/route.ts` (POST). Steps, in order:

1. **Read the RAW body** (`await req.text()`) — signature is over the exact
   bytes; parsing first breaks verification.
2. Verify (§7.2); on mismatch → `401`, log, done.
3. Parse; switch on `type`: `PAYMENT_SUCCESS_WEBHOOK` → `record_payment` RPC;
   `PAYMENT_FAILED_WEBHOOK` / `PAYMENT_USER_DROPPED_WEBHOOK` → record last
   failure state (order stays `unpaid`; the user can retry until expiry).
4. **Cross-check amount**: the webhook's paid amount must equal the order's
   stored `total_paise` (via one conversion at the boundary) — reject and
   alert on mismatch; never mark paid on a partial/altered amount.
5. Return `200` fast. Non-200 ⇒ Cashfree retries with backoff — correct
   behavior for transient DB failures, so let errors surface as 5xx.

### 7.2 Signature verification

Per [Cashfree's scheme](https://www.cashfree.com/docs/api-reference/vrs/webhook-signature-verification):
`x-webhook-signature = base64(HMAC-SHA256(x-webhook-timestamp + rawBody, CASHFREE_SECRET_KEY))`.

```ts
// lib/payments/webhook.ts — pure, unit-tested
import { createHmac, timingSafeEqual } from "node:crypto";

export function isValidCashfreeSignature(rawBody: string, timestamp: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);   // constant-time
}
```

Also reject timestamps older than ~5 minutes (replay guard). This route is
exempt from the form honeypot/rate-limit paths but should still ride a
generous rate limit.

### 7.3 Effects on payment success (inside/after `record_payment`)

Exactly once (guaranteed by the RPC's idempotency): payment marked, order
becomes visible in admin pending flow, **confirmation email queued** (reuse
`queueOrderConfirmationEmail`; Phase 7 copy layer gets a "payment received"
variant), admin new-order alert + push fire, cache tags invalidated
(`updateTag`, same tags as checkout).

### 7.4 Registration & environments

Dashboard → Developers → Webhooks → add
`https://staging.<domain>/api/webhooks/cashfree` (sandbox account) and
`https://<domain>/api/webhooks/cashfree` (production). Note: staging
basic-auth (DEPLOYMENT_PLAN §2) must **exclude** `/api/webhooks/*` or
Cashfree's calls bounce off Traefik with a 401 before reaching the app.

## 8. Unpaid-order expiry (stock correctness)

`place_order` decrements stock at order time (existing behavior). An online
order that never gets paid must give its stock back:

- Cashfree side: `order_expiry_time` = +30 min bounds how long payment stays
  possible.
- Our side: a **third cron route** `GET /api/cron/expire-unpaid-orders`
  (same `CRON_SECRET` bearer + `app_secret` contract as the existing two,
  DEPLOY_DOKPLOY §4.3–4.4), scheduled `*/15 * * * *`: cancel `unpaid` online
  orders older than the expiry window **after** a final
  `getCashfreeOrderPayments` check (the payment might have landed with a lost
  webhook), restoring stock via the existing cancel path.

## 9. CSP & security checklist

`proxy.ts` nonce CSP additions (the browser SDK loads from Cashfree):

- `script-src`: `https://sdk.cashfree.com` (the nonce'd `load()` import;
  `'strict-dynamic'` covers its descendants — verify in-browser, console
  clean, like the 4.x CSP passes).
- `connect-src`: `https://sandbox.cashfree.com` (staging) /
  `https://api.cashfree.com` (prod).
- `form-action` / redirect flow: full-page redirect to Cashfree's hosted page
  is a navigation, not a fetch — confirm `form-action 'self'` still holds
  (the action posts to us; *we* trigger the redirect via the SDK).
- Secrets: `CASHFREE_SECRET_KEY` is server-only (client module is
  `import "server-only"`); the browser sees exactly one value:
  `payment_session_id` (single-use, order-scoped, price-blind).
- **security-reviewer agent pass is mandatory** before merge (payment code —
  project code-review rule).

## 10. Testing

- **Unit** (`bun test`): `paiseToRupeeString` (0, <₹1, exact rupees, max
  order), signature verifier (valid/invalid/length-mismatch/stale timestamp),
  `submitCheckout` online branch (RPC payload price-free; CF create-order
  failure leaves order `unpaid`; no email queued), webhook handler
  (success/failure/dropped, idempotent double-delivery, amount mismatch
  rejected).
- **Sandbox E2E on staging**: Playwright journey — checkout → "Pay online" →
  sandbox checkout (test UPI/cards per Cashfree's sandbox docs) → return →
  confirmation shows paid → admin sees the order. Webhook leg needs the
  staging deploy (Cashfree must reach it); keep this in the label-gated E2E
  job, not the default CI path.
- **Manual, once per environment**: pay a real ₹1 order in production after
  go-live, verify webhook → paid → email → settlement appears in the Cashfree
  dashboard; then refund it via `createCashfreeRefund`.

## 11. Suggested TASKS.md phase breakdown

When scheduled (after the Phase 8 launch blockers), roughly:

1. Env + settings toggle + thin client + money/signature pure modules (unit-tested, no UI).
2. Migration: order columns, `place_order` ONLINE tender, `record_payment` RPC.
3. `submitCheckout` online branch + checkout UI (method radio, SDK redirect) + CSP.
4. Webhook route + email/alert/cache effects + confirmation-page states.
5. Expiry cron + stock restore.
6. Staging sandbox E2E + security review + operator runbook (dashboard, settlements, refunds).
7. Production keys, webhook registration, ₹1 live test — via DEPLOYMENT_PLAN §6.

**Deferred by design**: refund UI (builds with Phase 8.7 returns — §5's
`createCashfreeRefund` is its seam), partial payments/COD-advance, saved
cards/subscriptions, Cashfree payouts.

---

References: [Create Order API](https://www.cashfree.com/docs/api-reference/payments/latest/orders/create) ·
[Webhook signature verification](https://www.cashfree.com/docs/api-reference/vrs/webhook-signature-verification) ·
[cashfree-pg Node SDK](https://github.com/cashfree/cashfree-pg-sdk-nodejs) (not adopted; API reference useful) ·
[Web checkout preview](https://www.cashfree.com/devstudio/preview/pg/web/checkout) ·
[Pricing](https://www.cashfree.com/payment-gateway-charges/)

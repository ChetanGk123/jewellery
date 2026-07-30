# Production environment — self-hosted Supabase on Dokploy

Everything you must set to run this store in production against a self-hosted
Supabase created from the [`supabase-db`
blueprint](https://github.com/ChetanGk123/dokploy-templates/tree/main/blueprints/supabase-db).

There are **two separate Dokploy applications**, each with its own Environment
panel, and values flow one way between them:

```
┌─ Supabase stack (blueprint) ─────────┐      ┌─ Next.js app (this repo) ────────┐
│  JWT_SECRET      (auto-generated)    │      │  NEXT_PUBLIC_SUPABASE_URL        │
│  ANON_KEY        ──────────────────────────►│  NEXT_PUBLIC_SUPABASE_..._KEY    │
│  SERVICE_ROLE_KEY ─────────────────────────►│  SUPABASE_SECRET_KEY             │
│  SUPABASE_HOST   ──────────────────────────►│  (origin of the URL above)       │
│  SITE_URL        ◄─────────────────────────── NEXT_PUBLIC_SITE_URL            │
└──────────────────────────────────────┘      └──────────────────────────────────┘
```

Three things are worth internalising before the tables, because each has caused
a silent, hard-to-read failure on this project:

1. **`NEXT_PUBLIC_*` is compiled in, not read at runtime.** Changing one requires
   a **rebuild**, not a restart.
2. **Both API keys are signed with the stack's `JWT_SECRET`.** They are valid
   only for the stack that generated them. Rotating that secret invalidates both
   — see [§5 Rotating secrets](#5-rotating-secrets).
3. **Env vars are not the whole deploy.** Four requirements live in the database
   (§3) and are invisible to any env panel.

---

## 1. Supabase stack

### Auto-generated — never edit

Dokploy generates these on import. Copy them out; don't invent your own.

| Variable | Notes |
|---|---|
| `POSTGRES_PASSWORD` | |
| `JWT_SECRET` | Signs both API keys below. Rotating it is a breaking change. |
| `ANON_KEY` | Public, RLS-enforced. Goes to the app as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. |
| `SERVICE_ROLE_KEY` | **Bypasses RLS.** Goes to the app as `SUPABASE_SECRET_KEY`. Server-only, never `NEXT_PUBLIC_*`. |
| `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` | Basic-auth for Studio at the Supabase domain. |
| `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `PG_META_CRYPTO_KEY`, `LOGFLARE_*`, `S3_PROTOCOL_*` | Internal service secrets. |

### You must set these

| Variable | Value | Why |
|---|---|---|
| `SUPABASE_HOST` | `jewellery-db.example.org` | The stack's own domain; also the Dokploy Domain for service `kong`, port `8000`. |
| `SITE_URL` | `https://shop.example.org` | **The storefront's URL, not Supabase's.** GoTrue's default redirect after confirmation / magic link / OAuth. Pointing this at Supabase sends users to the wrong host after sign-in. |
| `ADDITIONAL_REDIRECT_URLS` | `https://shop.example.org/*` | Allow-list for `redirect_to`. Add every origin the app runs on — prod, staging, `http://localhost:3000` for local auth testing. |
| `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` | `https://jewellery-db.example.org` | Must match the real scheme + domain. |

### ⚠️ Email is not configured by default

The blueprint ships:

```
SMTP_HOST=supabase-mail      ← no such container exists in the compose
SMTP_USER=fake_mail_user
ENABLE_EMAIL_AUTOCONFIRM=false
```

So GoTrue is told to require email confirmation, and to send that mail to a host
that does not resolve. **Email/password sign-up and password reset are both dead
in production until you fix this.** Two options:

- **Real SMTP (recommended).** Set `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` /
  `SMTP_PASS` / `SMTP_ADMIN_EMAIL` / `SMTP_SENDER_NAME` to a provider (Resend,
  Postmark, SES). This is separate from the app's `RESEND_API_KEY`, which only
  sends order emails — auth mail is GoTrue's job.
- **Skip confirmation.** `ENABLE_EMAIL_AUTOCONFIRM=true` lets accounts work
  immediately without mail, but password reset still cannot send, and unverified
  addresses become valid accounts.

Google OAuth sidesteps both (`ENABLE_GOOGLE_SIGNUP=true` with a real
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` =
`https://<supabase-host>/auth/v1/callback` registered in Google Cloud).

---

## 2. Next.js app

Set in the **app's** Dokploy Environment panel. `docker-compose.yml` forwards
each one explicitly, and passes the `NEXT_PUBLIC_*` three as build args.

### Required

| Variable | Where it comes from | Timing |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://` + stack's `SUPABASE_HOST` | **build** + runtime |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | stack's `ANON_KEY` | **build** |
| `NEXT_PUBLIC_SITE_URL` | the storefront's own origin | **build** |
| `SUPABASE_SECRET_KEY` | stack's `SERVICE_ROLE_KEY` | runtime |

Without `SUPABASE_SECRET_KEY` every `/admin` write fails — `lib/db/admin.ts`
needs it to bypass RLS. Without the two public keys the build itself fails, by
design: `lib/env.ts` validates them with Zod at module load.

`NEXT_PUBLIC_SITE_URL` being build-time is easy to get wrong. `sitemap.xml` and
`robots.txt` are prerendered, so a runtime-only value publishes
`http://localhost:3000` URLs to search engines.

### Optional — each degrades to a no-op, never a crash

| Variable | Unset behaviour |
|---|---|
| `RESEND_API_KEY` | Order emails silently skip; checkout still completes and the confirmation page adapts its copy. |
| `EMAIL_FROM` | Falls back to `onboarding@resend.dev`. A custom address needs a verified Resend domain. |
| `ADMIN_ALERT_EMAIL` | New-order alerts fall back to the store email in Settings. |
| `CRON_SECRET` | `/api/cron/*` returns **503**. Must also exist as an `app_secret` row (§3). |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Admin push off; Settings → Notifications shows "not configured". Generate with `bunx web-push generate-vapid-keys`. Requires `CRON_SECRET` too. |

### Never set in production

`E2E_USER_EMAIL` / `E2E_USER_PASSWORD` are Playwright credentials, and that suite
writes **real orders** into whatever project it points at. `RAZORPAY_*` and
`SHIPROCKET_*` are placeholders — no code reads them (v1 is COD-only).

---

## 3. Database setup — not covered by any env panel

Three files, run in order. The split is strict: the migration creates structure
and **zero rows**, `seed.sql` adds only what the app cannot function without,
and `seed_demo.sql` is optional sample content.

| # | File | Run where | What it does |
|---|---|---|---|
| 1 | `supabase/migrations/0001_initial_schema.sql` | every environment | Tables, functions, triggers, RLS policies, storage buckets. No data. |
| 2 | `supabase/seed.sql` | every environment, **including production** | The settings singleton, the BRIDE20 coupon, a generated cron secret, and the first admin account. |
| 3 | `supabase/seed_demo.sql` | dev/staging only | 20 products, 5 orders, reviews, coupons, a demo customer. Never on a public production database. |

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_initial_schema.sql
psql "$DATABASE_URL" -f supabase/seed.sql        # prints credentials — copy them
psql "$DATABASE_URL" -f supabase/seed_demo.sql   # optional
```

**Before running step 2, edit the admin email** at the top of `seed.sql` §4 —
it is the account you will sign in to `/admin` with. The file then prints, as a
result set:

- **`CRON_SECRET`** — a generated 64-char value written to `app_secret`. Copy it
  into the app's `CRON_SECRET` env var; the two must match exactly, because the
  route checks the bearer token while `get_daily_digest` re-checks this row, so
  a leaked URL alone yields nothing. Re-running `seed.sql` **rotates** it.
- **Admin email and a generated password** — nothing weak is committed to the
  repo. Re-running does not reset an existing account's password.

Why each is mandatory: without the settings row, every admin Settings save fails
with `SETTINGS_ROW_MISSING` (`admin_update_settings` is an
`UPDATE ... WHERE id = true` with no insert). Without the coupon, the cart's
input still advertises `placeholder="Coupon code (try BRIDE20)"` and rejects it.
Without the admin, there is no way in at all — `admin_grant_role` gates on
`is_admin()`, which needs an admin to already exist, so the first one has to be
written straight into `auth.users`.

---

## 4. Order of operations

1. Deploy the Supabase stack; wait for every container healthy.
2. Copy `ANON_KEY`, `SERVICE_ROLE_KEY`, `SUPABASE_HOST` out of its env.
3. Set the stack's `SITE_URL` + `ADDITIONAL_REDIRECT_URLS` to the app's domain,
   and configure SMTP (§1).
4. Apply the migration, then `seed.sql`; do the §3 database steps.
5. Fill the app's Environment panel (§2); add its Domain → service `web`, port
   `3000`, HTTPS on.
6. **Deploy the app** — a build, not a restart, so the `NEXT_PUBLIC_*` values are
   compiled in.
7. Verify: `curl https://<app>/robots.txt` should show your real domain in the
   `Sitemap:` line, not `localhost`.

---

## 5. Rotating secrets

Rotating the stack's `JWT_SECRET` invalidates `ANON_KEY` and `SERVICE_ROLE_KEY`
together. The symptom is a bare `{"message":"Unauthorized"}` from Kong on every
request, which reads like a permissions bug rather than a stale key. After any
rotation:

1. Copy the new `ANON_KEY` / `SERVICE_ROLE_KEY` into the app's env **and** local
   `.env.local`.
2. **Rebuild** the app (the publishable key is compiled in).
3. **Re-seed the Realtime tenant.** `_realtime.tenants` stores its own encrypted
   copy of the JWT secret, so it goes stale and every websocket 403s:
   ```sql
   delete from _realtime.tenants;
   ```
   then restart the `realtime` container — `SEED_SELF_HOST=true` recreates it
   with the current secret.
4. All existing sessions are invalidated; signed-in users are logged out once.

### Realtime tenant naming

Realtime resolves its tenant from the **first label of the Host header** Kong
sends, and `SEED_SELF_HOST` only ever creates a tenant called `realtime-dev`.
Blueprint versions whose Kong upstream is `http://realtime:4000` therefore look
up a tenant named `realtime`, find nothing, and reject every subscription with an
empty-bodied 403 — REST, Auth and Storage all keep working, so it looks like an
app bug. The live admin console (orders, reviews, messages) goes dead.

Confirm with:

```bash
curl -H "apikey: $ANON_KEY" https://<supabase-host>/realtime/v1/api/ping
# {"message":"Success"}                      → fine
# {"message":"Tenant not found in database"} → the mismatch above
```

Fixed in the blueprint by giving the `realtime` service a `realtime-dev` network
alias and pointing both Kong upstreams at it. If your stack predates that, either
redeploy from the current template or add the missing tenant by hand.

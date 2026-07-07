# Self-Hosting Supabase for RJ Jewellers

A step-by-step runbook for pointing this app at a **self-hosted** Supabase stack
instead of the managed cloud project (`naolegptozpaiojozzcy`). Tailored to this
repo: it accounts for the specific migrations, auth flows, storage bucket, and
email templates the app depends on, and assumes you deploy on **Dokploy**
(Docker Compose) like the app itself.

> **Do you actually need this?** No — the app runs fine against managed
> Supabase while the Next.js app is hosted on Dokploy. Self-host only for data
> residency, cost-at-scale, or single-box ownership. It means **you** now run
> Postgres, Auth, Storage, and backups. If you just want a working deploy, keep
> managed Supabase and skip this document.

---

## 0. What "self-hosted Supabase" actually is

A Docker Compose bundle of independent services behind one gateway:

| Service | Role | This app uses it for |
|---|---|---|
| **Postgres** | the database | all data + RLS + SECURITY DEFINER RPCs |
| **GoTrue** (auth) | sign-up/in, JWT issuance | email+password, email OTP, Google OAuth (2.8) |
| **PostgREST** | REST over Postgres | every `supabase.from()` / `.rpc()` call |
| **Storage** | object storage | `product-images` bucket (migration 0010) |
| **Kong** | API gateway | the single URL the app talks to |
| **Studio** | admin UI | running migrations, inspecting data |
| Realtime, Meta, Analytics | live queries, schema, logs | not used by this app today |

The app only ever talks to **Kong** (one URL) with the **anon key**. Everything
else is internal.

---

## 1. Prerequisites

- A host with Docker + Docker Compose v2 (your Dokploy host works).
- A domain/subdomain for the Supabase gateway, e.g. `supabase.yourdomain.com`,
  with DNS pointing at the host.
- An SMTP provider for auth/transactional email (Resend, SES, Postmark…).
  Self-hosted Supabase ships **no email sender** — nothing emails until this is
  set.
- `openssl` (secret generation) and `psql` (applying SQL), or use Studio's SQL
  editor.

---

## 2. Stand up the stack

### Option A — Dokploy template (recommended)

Dokploy ships a Supabase template that wires the whole compose bundle for you:

1. Dokploy → **Create → Template → Supabase**.
2. Fill the generated env (secrets — see §3).
3. Add a **Domain** → point it at the **Kong** service, port `8000`.
4. Deploy.

### Option B — Official compose

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# edit .env (see §3), then:
docker compose up -d
```

Put Kong (`:8000`) behind your reverse proxy / Traefik with TLS, exactly the way
the app container is routed on Dokploy.

---

## 3. Secrets and core config

Generate these **before first boot** and keep them stable (changing `JWT_SECRET`
later invalidates every issued key and session):

```bash
# strong random values
openssl rand -base64 48   # POSTGRES_PASSWORD
openssl rand -base64 48   # JWT_SECRET (>= 32 chars)
```

Then derive the API keys **from** `JWT_SECRET` — they are JWTs whose payload is
`{"role":"anon"}` / `{"role":"service_role"}` signed with that secret. Use the
generator in the Supabase self-hosting docs (Settings → API key generator) to
produce a matching `ANON_KEY` and `SERVICE_ROLE_KEY`.

Minimum `.env` for the Supabase stack:

```dotenv
POSTGRES_PASSWORD=...            # from openssl
JWT_SECRET=...                   # from openssl, >=32 chars
ANON_KEY=eyJ...                  # signed with JWT_SECRET, role=anon
SERVICE_ROLE_KEY=eyJ...          # signed with JWT_SECRET, role=service_role

SITE_URL=https://app.yourdomain.com          # the STOREFRONT app origin
API_EXTERNAL_URL=https://supabase.yourdomain.com
SUPABASE_PUBLIC_URL=https://supabase.yourdomain.com

DASHBOARD_USERNAME=admin         # Studio basic-auth
DASHBOARD_PASSWORD=...           # Studio basic-auth
```

> **Key format note.** Managed Supabase gave you the new
> `sb_publishable_...` / `sb_secret_...` keys. Self-host classically issues the
> legacy `eyJ...` JWT `anon` / `service_role` keys. `@supabase/ssr` (used here)
> works with **either** — you just plug whatever your stack issues into the
> app's env (§6). The env var is *named* `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
> but its value is simply "the anon key".

---

## 4. Apply this repo's schema (migrations 0001 → 0027)

**All of `supabase/migrations/*.sql` must be applied, in filename order.** They
define the tables, RLS policies, and every `SECURITY DEFINER` RPC — skipping or
reordering any of them breaks checkout, admin writes, the 5.8 audit triggers, or
the 5.9 coupon delete.

### With the Supabase CLI (preferred)

```bash
# from the repo root
export SUPABASE_DB_URL="postgresql://postgres:<POSTGRES_PASSWORD>@supabase.yourdomain.com:5432/postgres"
supabase db push --db-url "$SUPABASE_DB_URL"
```

### With psql (no CLI)

```bash
for f in supabase/migrations/0*.sql; do
  echo ">> $f"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

### With Studio

Open Studio → **SQL Editor**, then paste and run each migration file **in order,
0001 first**. Stop on the first error.

Migration checklist (what each critical one gives you):

- `0001–0003` orders + `place_order` RPC + confirmation
- `0004` customer auth (`customer_profile`, `order.user_id`, owner RLS)
- `0005–0006` admin role + `is_admin()` + admin read policies
- `0007–0018` admin order status, products, media, storage bucket, categories,
  coupons, reviews, contact, subscribers, settings
- `0019–0025` stock enforcement, customer cancel, review-requires-purchase,
  team management, session revoke, COD toggle
- `0026` **admin audit log** (triggers) · `0027` **coupon delete**

After applying, seed reference data (categories/products) however you normally
do — via Studio, a seed SQL file, or the admin console once the app is up.

---

## 5. Configure Auth (GoTrue)

On self-host these are **environment variables on the auth container**, not
dashboard toggles.

### 5.1 URLs (must match the app)

```dotenv
GOTRUE_SITE_URL=https://app.yourdomain.com
GOTRUE_URI_ALLOW_LIST=https://app.yourdomain.com/auth/callback,https://app.yourdomain.com/account/reset-password
```

These replace the managed project's "Site URL / Redirect allowlist". The app's
`/auth/callback` (2.8/2.8b) must be allow-listed or magic-link / OAuth / recovery
all dead-end.

### 5.2 SMTP (required for any email)

```dotenv
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=resend
GOTRUE_SMTP_PASS=<smtp-password>
GOTRUE_SMTP_ADMIN_EMAIL=care@rjjewellers.in
GOTRUE_SMTP_SENDER_NAME=RJ Jewellers
```

Without this, sign-up confirmation and email OTP silently fail.

### 5.3 Google OAuth (2.8)

```dotenv
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=...
GOTRUE_EXTERNAL_GOOGLE_SECRET=...
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://supabase.yourdomain.com/auth/v1/callback
```

Add that redirect URI to the Google Cloud OAuth client's authorised list too.

### 5.4 Email templates — ⚠️ different from managed

`supabase/templates/apply.sh` (2.8c) posts to the **hosted Management API** and
**will not work** against self-host. Instead, mount the four HTML templates and
point GoTrue at them:

```dotenv
GOTRUE_MAILER_TEMPLATES_MAGIC_LINK=/etc/gotrue/templates/magic-link.html
GOTRUE_MAILER_TEMPLATES_CONFIRMATION=/etc/gotrue/templates/confirm-signup.html
GOTRUE_MAILER_TEMPLATES_RECOVERY=/etc/gotrue/templates/reset-password.html
GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE=/etc/gotrue/templates/email-change.html
```

Mount `supabase/templates/*.html` into the auth container at that path via a
compose volume. The templates already link through `/auth/callback?...` with
`{{ .TokenHash }}`, so they work as-is once mounted.

> Confirm the **Email OTP length** matches the app. 2.8c relaxed the client
> regex to `^\d{6,10}$`, so 6- or 8-digit codes both pass — set
> `GOTRUE_MAILER_OTP_LENGTH` to whatever you prefer within that range.

---

## 6. Point the app at your stack

Set these in the **app's** Dokploy Environment panel (not the Supabase stack's):

```dotenv
# build-time (Next inlines NEXT_PUBLIC_* into the browser bundle)
NEXT_PUBLIC_SUPABASE_URL=https://supabase.yourdomain.com
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your ANON_KEY>

# runtime
NEXT_PUBLIC_SITE_URL=https://app.yourdomain.com
SUPABASE_SECRET_KEY=<your SERVICE_ROLE_KEY>    # only if a path needs it
RESEND_API_KEY=...                              # app-level order emails (4.6/5.2)
EMAIL_FROM=care@rjjewellers.in
ADMIN_ALERT_EMAIL=...
```

Notes:
- `NEXT_PUBLIC_*` are **build args** — they must be present when the image
  builds (see `docker-compose.yml` in the repo), not just at runtime.
- The app talks only to `NEXT_PUBLIC_SUPABASE_URL` (Kong). No other Supabase
  host is ever referenced.
- Redeploy the app after changing build-time vars so they re-inline.

---

## 7. Storage bucket

Migration `0010` creates the public `product-images` bucket and its
`is_admin()`-gated write policies. This only works if the **Storage** service is
running in your stack (it is, in the standard compose). Verify in Studio →
Storage that `product-images` exists after migrations. Admin product-image
uploads (3.4) use the admin cookie session — no service key.

---

## 8. Smoke test

1. **App boots**: hit `https://app.yourdomain.com/` — home renders products from
   your DB.
2. **Auth**: sign up → confirmation email arrives (proves SMTP) → `/auth/callback`
   → `/account`.
3. **Checkout**: add to cart → place a COD order → confirmation page shows a real
   `RJ-YYMMDD-####-XXXX` order number (proves `place_order` RPC + RLS).
4. **Admin**: grant your user admin (`update auth.users set raw_app_meta_data =
   raw_app_meta_data || '{"role":"admin"}' where email = '...'`), sign in, open
   `/admin` → orders/products/coupons load.
5. **Audit (5.8)**: change an order status as admin → a row appears in
   `admin_audit_log`.

---

## 9. Operational responsibilities (now yours)

- **Backups**: schedule `pg_dump` (or volume snapshots) — managed Supabase did
  this automatically; self-host does not.
  ```bash
  pg_dump "$SUPABASE_DB_URL" -Fc -f backup-$(date +%F).dump
  ```
- **Upgrades**: pin the Supabase compose image tags; test upgrades on a copy
  first (auth/storage schema migrations run on start).
- **TLS/renewal**: handled by your reverse proxy (Traefik on Dokploy).
- **Monitoring**: watch disk (Postgres + Storage volumes) and container health.
- **Secrets**: never commit `.env`; store keys in Dokploy's env panel.

---

## 10. Differences from the managed workflow (quick reference)

| Task | Managed (today) | Self-hosted |
|---|---|---|
| Apply migrations | Supabase MCP / dashboard | `psql` / `supabase db push` / Studio |
| Auth settings | Dashboard toggles | GoTrue env vars (§5) |
| Email templates | `templates/apply.sh` (Mgmt API) | mounted files + GoTrue env (§5.4) |
| API keys | `sb_publishable_…` / `sb_secret_…` | legacy `eyJ…` anon / service_role JWTs |
| Backups | automatic | your `pg_dump` / snapshots |
| URL | `*.supabase.co` | your Kong domain |

---

## 11. Rollback / going back to managed

Because the app only depends on three things — the Supabase **URL**, the **anon
key**, and the **schema** — reverting is just: point `NEXT_PUBLIC_SUPABASE_URL`
+ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` back at the managed project and redeploy.
Keep the managed project's data current (or migrate data with `pg_dump` →
`pg_restore`) before switching either direction.

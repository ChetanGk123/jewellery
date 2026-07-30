# Self-Hosting Supabase for RJ Jewellers

A step-by-step runbook for pointing this app at a **self-hosted** Supabase stack
instead of the managed cloud project (`naolegptozpaiojozzcy`). Tailored to this
repo: it accounts for the specific schema, auth flows, storage bucket, and
email templates the app depends on, and assumes you deploy the
[`supabase-homelab` Dokploy blueprint](https://github.com/ChetanGk123/dokploy-templates/tree/main/blueprints/supabase-homelab)
(a pre-wired fork of the official Supabase compose bundle, Kong pinned to
`dokploy-network` so Traefik routing survives restarts) on the same Dokploy
host as the app.

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

- Dokploy `>= 0.22.5` on the host that will run the blueprint (your app's host
  works).
- A domain/subdomain for the Supabase gateway (the blueprint's `main_domain`,
  e.g. `jewellery-db.chetanlab.org`), with DNS pointing at the host.
- An SMTP provider for auth/transactional email (Resend, SES, Postmark…). The
  blueprint ships with placeholder SMTP values — nothing emails until this is
  set (§5.2).
- `psql` for applying the schema (§4), or use Studio's SQL editor instead —
  no `openssl`/manual secret generation needed, Dokploy generates those on
  import (§2–3).

---

## 2. Stand up the stack

Import the [`supabase-homelab`](https://github.com/ChetanGk123/dokploy-templates/tree/main/blueprints/supabase-homelab)
blueprint (requires Dokploy `>= 0.22.5`):

1. Dokploy → **Create → Template**, point it at that blueprint.
2. Before importing, edit `main_domain` in `template.toml` if you don't want
   the default `<project>-db.chetanlab.org` pattern — Dokploy's template
   engine has no project-name helper, so this has to be baked in up front. It
   feeds `SUPABASE_HOST`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, and
   `ADDITIONAL_REDIRECT_URLS` automatically.
3. Point a DNS record at your Dokploy host for that domain.
4. Deploy and wait for every container (`db`, `kong`, `auth`, `rest`,
   `storage`, `realtime`, `studio`, `meta`, `functions`, …) to go healthy —
   the first boot takes a few minutes while Postgres initializes.

Dokploy **auto-generates every secret** for you on import
(`POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`,
`DASHBOARD_PASSWORD`, …) — no manual `openssl`/JWT-crafting needed. Review them
in the service's **Environment** tab after deploy.

---

## 3. Secrets and core config

Everything in this section is **already generated** by the blueprint import
(§2) — this is just what to look at and what to change.

In the deployed service's **Environment** tab:

```dotenv
POSTGRES_PASSWORD=...            # auto-generated
JWT_SECRET=...                   # auto-generated
ANON_KEY=eyJ...                  # auto-generated, signed with JWT_SECRET, role=anon
SERVICE_ROLE_KEY=eyJ...          # auto-generated, signed with JWT_SECRET, role=service_role

SITE_URL=http://localhost:3000                        # ← change to the APP's real origin
ADDITIONAL_REDIRECT_URLS=https://<main_domain>/*,http://localhost:3000/*
API_EXTERNAL_URL=https://<main_domain>                # set from main_domain automatically
SUPABASE_PUBLIC_URL=https://<main_domain>              # set from main_domain automatically

DASHBOARD_USERNAME=supabase      # Studio basic-auth (behind Kong, port 8000)
DASHBOARD_PASSWORD=...           # auto-generated
```

`SITE_URL` ships pointing at `http://localhost:3000` — **this must become the
app's real domain**, and `ADDITIONAL_REDIRECT_URLS` must include the app's
`/auth/callback` origin (see §5.1), or magic-link/OAuth/recovery emails send
links back to `localhost`.

> **Key format note.** Managed Supabase gives you the newer
> `sb_publishable_...` / `sb_secret_...` keys. This blueprint issues the
> classic `eyJ...` JWT `anon` / `service_role` keys (`ANON_KEY` /
> `SERVICE_ROLE_KEY`) by default — it *can* also front the new key format via
> `SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_SECRET_KEY` (its Kong entrypoint checks
> for them), but those aren't set unless you add them yourself. `@supabase/ssr`
> (used here) works with **either** — just plug whatever your stack issues
> into the app's env (§6). The app's env var is *named*
> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` but its value is simply "the anon key".

---

## 4. Apply this repo's schema

**`supabase/migrations/0001_initial_schema.sql` is the entire schema** — every
table, RLS policy, and `SECURITY DEFINER` RPC the app depends on, squashed into
one file representing the current end state (superseding the old
`0000a`–`0044` history). Apply it once, then `supabase/seed.sql` (seeds the
required `setting` singleton row — `admin_update_settings` is an `UPDATE`, not
an `UPSERT`, so the app's Settings page can't self-heal a missing row).

### With psql (simplest — no CLI setup needed)

```bash
export SUPABASE_DB_URL="postgresql://postgres:<POSTGRES_PASSWORD>@<main_domain>:5432/postgres"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_initial_schema.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
```

(The blueprint doesn't expose Postgres on a public port by default — either
open `POSTGRES_PORT` on the `db` service temporarily, tunnel through the
Dokploy host, or use Studio's SQL Editor / Terminal instead.)

### With Studio

Open Studio (`https://<main_domain>`, basic-auth from §3) → **SQL Editor**,
paste `0001_initial_schema.sql`, run it, then do the same for `seed.sql`.

### With the Supabase CLI

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```

After applying, seed catalog data (categories/products) however you normally
do — via Studio, a seed script, or the admin console once the app is up. Grant
your own account admin per the bootstrap `UPDATE` at the bottom of
`0001_initial_schema.sql` (edit the email first), or run it again by hand for
a different account.

### Don't forget: the `app_secret` row

`app_secret` is created empty by the schema — it holds no rows until you add
one. The daily-digest (5.17) and Web Push (6.17) cron RPCs
(`get_daily_digest`, `get_push_subscriptions`, `prune_push_subscriptions`,
`get_abandoned_carts`, `mark_carts_reminded`) all compare their `p_secret`
argument against this row and fail closed (`NOT_CONFIGURED`/`FORBIDDEN`)
without it. In the same Studio/psql session as the schema apply above, run:

```sql
insert into app_secret (name, value) values ('cron', '<same value as CRON_SECRET>');
```

Use the same value you set for `CRON_SECRET` in the app's env (§6). This is
per-database — the old managed project's `app_secret` row does **not** carry
over, so this step is easy to forget on a fresh self-hosted instance and the
symptom (cron endpoints silently failing) doesn't show up until the first
scheduled run.

---

## 5. Configure Auth (GoTrue)

This blueprint exposes GoTrue's settings as **bare top-level env vars** on the
service (Dokploy's compose maps them to the `GOTRUE_*` names internally) — set
these in the same **Environment** tab as §3, not a separate auth container.

### 5.1 URLs (must match the app)

```dotenv
SITE_URL=https://app.yourdomain.com
ADDITIONAL_REDIRECT_URLS=https://app.yourdomain.com/*,https://<main_domain>/*
```

`SITE_URL` ships as `http://localhost:3000` by default (§3) — change it to the
**app's** origin, not the Supabase domain. The app's `/auth/callback` (and
`/account/reset-password`) must resolve under an allow-listed origin or
magic-link / OAuth / recovery all dead-end. `ADDITIONAL_REDIRECT_URLS` supports
wildcards (`/*`), so listing the app's origin once is enough.

### 5.2 SMTP (required for any email)

```dotenv
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<smtp-password>
SMTP_ADMIN_EMAIL=care@rjjewellers.in
SMTP_SENDER_NAME=RJ Jewellers
```

The blueprint ships with placeholder SMTP values (`supabase-mail`,
`fake_mail_user`/`fake_mail_password`) — **nothing sends until these are real**.
Without this, sign-up confirmation and email OTP silently fail.

### 5.3 Google OAuth (2.8)

```dotenv
ENABLE_GOOGLE_SIGNUP=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://<main_domain>/auth/v1/callback   # pre-filled by the blueprint
```

Register `GOOGLE_REDIRECT_URI`'s value as an authorised redirect URI in the
[Google Cloud Console](https://console.cloud.google.com/apis/credentials),
then redeploy the service. GitHub/Apple follow the same
`ENABLE_*_SIGNUP`/`*_CLIENT_ID`/`*_CLIENT_SECRET` pattern — see the blueprint's
own `instructions.md` for the exact steps (Apple additionally needs a rotating
JWT client secret).

### 5.4 Email templates — ⚠️ different from managed

`supabase/templates/apply.sh` (2.8c) posts to the **hosted Management API** and
**will not work** against self-host. The blueprint doesn't mount custom
templates by default (GoTrue's plain built-in templates are used), so to reuse
this repo's branded templates you need to add them yourself: mount
`supabase/templates/*.html` into the `auth` container via a compose volume
(edit the deployed `docker-compose.yml` for this service in Dokploy) and add:

```dotenv
GOTRUE_MAILER_TEMPLATES_MAGIC_LINK=/etc/gotrue/templates/magic-link.html
GOTRUE_MAILER_TEMPLATES_CONFIRMATION=/etc/gotrue/templates/confirm-signup.html
GOTRUE_MAILER_TEMPLATES_RECOVERY=/etc/gotrue/templates/reset-password.html
GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE=/etc/gotrue/templates/email-change.html
```

The templates already link through `/auth/callback?...` with `{{ .TokenHash }}`,
so they work as-is once mounted — this is the one piece the blueprint doesn't
give you for free.

> Confirm the **Email OTP length** matches the app. 2.8c relaxed the client
> regex to `^\d{6,10}$`, so 6- or 8-digit codes both pass — set
> `GOTRUE_MAILER_OTP_LENGTH` to whatever you prefer within that range.

---

## 6. Point the app at your stack

### 6.1 Code change: allow the new image host

`next.config.ts` hardcodes `images.remotePatterns` to
`naolegptozpaiojozzcy.supabase.co` — `next/image` refuses to optimize images
from any host not on that list, so product/category images will 400 until you
swap it:

```ts
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "<main_domain>",              // your blueprint's domain
      pathname: "/storage/v1/object/public/**",
    },
  ],
},
```

Commit this and redeploy the app.

### 6.2 Env vars

Set these in the **app's** Dokploy Environment panel (not the Supabase stack's):

```dotenv
# build-time (Next inlines NEXT_PUBLIC_* into the browser bundle)
NEXT_PUBLIC_SUPABASE_URL=https://<main_domain>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your ANON_KEY>

# runtime
NEXT_PUBLIC_SITE_URL=https://app.yourdomain.com
SUPABASE_SECRET_KEY=<your SERVICE_ROLE_KEY>    # required — the admin console (lib/db/admin.ts) throws without it
SMTP_HOST=smtp.gmail.com                        # app-level order emails (4.6/5.2/10.2)
SMTP_PORT=587                                   # optional; 587 STARTTLS (default), 465 implicit TLS
SMTP_USER=...                                   # all three of HOST/USER/PASS or email is a no-op
SMTP_PASS=...                                   # Gmail: an App Password
EMAIL_FROM=care@rjjewellers.in                  # only if SMTP_USER may send as it
ADMIN_ALERT_EMAIL=...
```

Notes:
- `NEXT_PUBLIC_*` are **build args** — they must be present when the image
  builds (see `docker-compose.yml` in the repo), not just at runtime.
- The app talks only to `NEXT_PUBLIC_SUPABASE_URL` (Kong). No other Supabase
  host is ever referenced.
- Redeploy the app after changing build-time vars so they re-inline.
- Mirror the same two `NEXT_PUBLIC_*` + `SUPABASE_SECRET_KEY` values into your
  local `.env.local` if you want to develop against the self-hosted stack too.

---

## 7. Storage buckets

`0001_initial_schema.sql` creates the public `product-images` bucket and the
private `return-photos` bucket, plus their `is_admin()`-gated write policies.
This only works if the **Storage** service is running in your stack (it is, in
the blueprint). Verify in Studio → Storage that both buckets exist after
applying the schema. Admin product-image uploads use the admin cookie
session — no service key.

---

## 8. Smoke test

1. **App boots**: hit `https://app.yourdomain.com/` — home renders products from
   your DB.
2. **Auth**: sign up → confirmation email arrives (proves SMTP) → `/auth/callback`
   → `/account`.
3. **Checkout**: add to cart → place a COD order → confirmation page shows a real
   `JR-YYMMDD-####-XXXX` order number (proves `place_order` RPC + RLS).
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

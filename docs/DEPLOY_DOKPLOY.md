# Deploying RJ Jewellers on Dokploy

A complete, repo-specific runbook for deploying this Next.js app on **Dokploy**
(self-hosted Docker Compose PaaS, Traefik reverse proxy). It covers the Compose
service, build-time vs runtime environment variables, domains/HTTPS, the
post-deploy Supabase configuration, and every failure we actually hit while
bringing this up — with the fix for each.

> Companion docs: [`SELF_HOSTED_SUPABASE.md`](./SELF_HOSTED_SUPABASE.md) (only if
> you also self-host the database), `ARCHITECTURE_PLAN.md`, `CLAUDE.md`.

---

## 0. How the deploy is wired

- The repo ships a **`docker-compose.yml`** and a multi-stage **`Dockerfile`**
  (builder → runner). Dokploy clones the repo, runs `docker compose up --build`,
  and routes traffic to the container with Traefik.
- There is a **single service, `web`**, that builds and serves the Next.js app on
  container port **3000**.
- The container port is **`expose`d, not published** to the host — Dokploy's own
  UI already owns host `:3000`, and Traefik routes to the container over the
  shared `dokploy-network` instead (see §5).

You configure three things in Dokploy: the **application source** (§2),
**environment variables** (§4), and a **domain** (§5). Everything else is in the
committed compose/Dockerfile.

---

## 1. Prerequisites

- A running **Dokploy** host (Docker + Traefik) with a public IP.
- This repo pushed to a Git remote Dokploy can reach (GitHub).
- A **Supabase project** (managed cloud, or self-hosted per the companion doc)
  with **all migrations applied** (`supabase/migrations/0000a`–`0040`, in
  filename order) and **`supabase/seed.sql` run once** (creates the `setting`
  singleton — without it every Settings save fails with
  `SETTINGS_ROW_MISSING`; the file also documents the first-admin bootstrap
  and the `app_secret` insert).
- A **domain** with DNS you control, pointed at the Dokploy host.
- Optional: a **Resend** account + verified sending domain (for order/status
  emails — the app degrades to a no-op without it).

---

## 2. Create the application in Dokploy

1. **Create → Application** (or **Compose**) in your Dokploy project.
2. **Source: Git** → your repo URL, branch `main`.
   - Private repo: add a deploy key / GitHub app in Dokploy first.
3. **Build type: Docker Compose** — Dokploy uses the repo's `docker-compose.yml`.
4. Save. Don't deploy yet — set env vars and the domain first (§4, §5).

---

## 3. What the committed `docker-compose.yml` does

You do **not** need to edit this — it's already correct. Reference:

```yaml
services:
  web:
    build:
      context: .
      args:
        # Inlined into the browser bundle at BUILD time (must exist when building).
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
    image: jr-jewellers:latest
    expose:
      - "3000"                      # reachable on the Docker network, NOT the host
    networks:
      - dokploy-network             # shared with Traefik
    environment:                    # runtime vars (${VAR:-} = optional)
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
      NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL:-}
      SUPABASE_SECRET_KEY: ${SUPABASE_SECRET_KEY:-}
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      EMAIL_FROM: ${EMAIL_FROM:-}
      ADMIN_ALERT_EMAIL: ${ADMIN_ALERT_EMAIL:-}
    env_file:                       # optional; absent files are ignored
      - path: .env
        required: false
      - path: .env.local
        required: false
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "bun", "-e", "fetch('http://127.0.0.1:3000/')..."]

networks:
  dokploy-network:
    external: true                  # created by Dokploy on the host
```

Why each non-obvious bit exists (all were real failures — see §7):

- **`expose` not `ports`** — publishing host `:3000` fails on a Dokploy host
  ("port is already allocated"); Traefik doesn't need a host port.
- **`networks: dokploy-network` (external)** — lets Traefik reach the container.
- **`env_file … required: false`** — a fresh clone has no `.env`/`.env.local`
  (both gitignored); a missing file must not fail the build. Needs Compose ≥ 2.24.
- **`${VAR:-}` defaults** — unset optional vars resolve to empty string instead
  of erroring.

---

## 4. Environment variables

Set these in the Dokploy app's **Environment** panel. There are two classes and
the distinction matters.

### 4.1 Build-time (inlined into the browser bundle)

Next.js bakes `NEXT_PUBLIC_*` into the client bundle **when the image builds**, so
they must be present in the **build** environment, not just at runtime. In the
compose they're passed as `build.args`.

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase project URL (or your Kong URL if self-hosted) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` / `eyJ…` | The **anon/publishable** key (RLS-safe, public) |

> ⚠️ **Confirm Dokploy passes the panel env into the *build* step**, not only the
> runtime container. If the built page shows a Supabase URL error, the build
> didn't receive these. Options if it doesn't: define them at the Dokploy
> project/build level, or hardcode non-secret public values as compose
> `build.args` defaults. (These two are public by design, so build-time exposure
> is fine.)

### 4.2 Runtime

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Recommended | Absolute origin for sitemap / robots / `metadataBase` / OG / JSON-LD. If unset the app **no longer crashes** (hardened in `lib/site-url.ts`) but SEO URLs fall back to `localhost`. Set it to your real `https://` domain. |
| `SUPABASE_SECRET_KEY` | Optional | Server-only service key; only paths that need elevated writes use it. The app is designed to run on the anon key + RLS/RPCs. |
| `RESEND_API_KEY` | Optional | Enables order-confirmation (4.6) + status/admin emails (5.2). No key ⇒ all sends are no-ops. |
| `EMAIL_FROM` | Optional | Sender address; needs a **verified Resend domain** to deliver beyond the Resend account owner. |
| `ADMIN_ALERT_EMAIL` | Optional | Recipient for the new-order admin alert (falls back to `STORE_INFO.email`). |
| `CRON_SECRET` | Optional | Bearer token for the cron routes (daily digest 5.17, abandoned carts 6.19). See §4.3–4.4. |

**Never** put `.env.local`, the E2E test creds, or any secret in the repo — they
belong only in the Dokploy Environment panel. `.env.local` is gitignored.

### 4.3 Daily digest cron (TASKS 5.17)

The close-of-day digest (yesterday's orders / revenue / pending / low-stock,
emailed to `ADMIN_ALERT_EMAIL`) is triggered by `GET /api/cron/daily-digest`.
Three one-time steps:

1. **Generate a secret** (`openssl rand -hex 32`) and set it as `CRON_SECRET`
   in the Dokploy Environment panel.
2. **Insert the same value into the database** (Supabase SQL editor) — the
   `get_daily_digest` RPC re-checks it against this sealed row (migration 0029):

   ```sql
   insert into app_secret (name, value) values ('cron', '<same value>');
   ```

3. **Schedule the call** once a day after IST close (e.g. 22:00 IST = 16:30
   UTC). Dokploy → the app → **Advanced → Cron Jobs** (runs inside the
   container), or any external scheduler:

   ```
   30 16 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-digest
   ```

The route answers `503` without `CRON_SECRET`, `401` on a bad bearer, `502`
when the RPC or the email send fails (so the scheduler's logs show misfires),
and `{ "ok": true, "date": …, "orders": … }` on success. Requires
`RESEND_API_KEY` — without it the send is a no-op and the route reports `502`.

### 4.4 Abandoned-cart cron (TASKS 6.19)

`GET /api/cron/abandoned-carts` emails signed-in customers whose synced cart
has sat idle for 24h+ (one reminder per abandonment; new cart activity
re-arms it). Same `CRON_SECRET` + `app_secret` row as §4.3 — no extra setup
beyond a second schedule, a few times a day:

```
0 */6 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/abandoned-carts
```

Same status contract as the digest route; `{ "ok": true, "carts": …, "sent": … }`
on success (carts whose send failed stay unmarked and retry on the next run).

---

## 5. Domain, routing, and HTTPS

Because the container port is **exposed, not published**, the app is unreachable
until you add a Domain so Traefik routes to it.

1. Dokploy app → **Domains → Add Domain**.
2. **Host**: `app.yourdomain.com` (DNS `A`/`CNAME` → the Dokploy host).
3. **Service**: `web`  ·  **Container Port**: `3000`.
4. **HTTPS**: enable; Dokploy provisions a Let's Encrypt certificate via Traefik.
5. Save, then **Deploy**.

After the domain resolves, set `NEXT_PUBLIC_SITE_URL=https://app.yourdomain.com`
(§4.2) and redeploy so SEO/OG URLs are correct.

---

## 6. Post-deploy: Supabase configuration

The app builds and serves without these, but **auth and email won't fully work**
until they're done. (For self-hosted Supabase these live in GoTrue env vars
instead — see the companion doc §5.)

1. **Auth → URL Configuration**
   - **Site URL** = `https://app.yourdomain.com`
   - **Redirect allowlist** = add `https://app.yourdomain.com/auth/callback` and
     `https://app.yourdomain.com/account/reset-password`. Without these,
     magic-link / OAuth / password-recovery dead-end.
2. **Auth → Providers → Google** — enable and paste the OAuth client ID/secret;
   add `https://<project>.supabase.co/auth/v1/callback` to the Google client's
   authorised redirect URIs (2.8 shipped the code; the provider must be turned on).
3. **Auth → Email Templates** — run `supabase/templates/apply.sh` with a personal
   access token to push the branded templates (2.8c), or paste them in the
   dashboard. Managed only — self-host mounts them instead.
4. **Resend** — verify your sending domain, then set `EMAIL_FROM` to an address on
   it and `RESEND_API_KEY` in the app env; redeploy. Until then email is a no-op.

---

## 7. Troubleshooting (issues we actually hit)

| Symptom in the deploy log | Cause | Fix |
|---|---|---|
| `.env.local … no such file or directory` | `env_file` required a gitignored file absent from a fresh clone | Already fixed: `env_file` entries are `required: false`; vars come from the panel. |
| `failed to compute cache key … "/app/public": not found` | `Dockerfile` copies `public/`, but git doesn't track empty dirs | Already fixed: `public/.gitkeep` keeps the dir in the tree. |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | Dokploy's own UI owns host `:3000` | Already fixed: `expose: "3000"` instead of `ports:`. Route via a Domain. |
| `network dokploy-network … could not be found` / not attachable | External network missing or created non-attachable | `docker network ls | grep -i dokploy` to confirm the name matches; ensure it's attachable. |
| `TypeError: "" cannot be parsed as a URL (ERR_INVALID_URL)` at render | `NEXT_PUBLIC_SITE_URL` empty → `new URL("")` | Already fixed in `lib/site-url.ts` (empty/invalid → localhost fallback). Set the var to your real origin for correct SEO. |
| `fatal: … tmp_pack_… No such file` / `fetch-pack: invalid index-pack output` | **Host git failure — usually disk full** mid-clone | On the host: `df -h`, then `docker system prune -af && docker builder prune -af`; or delete the deploy checkout and let Dokploy re-clone; then redeploy. |
| App starts but 502 / not reachable | No Domain, or Domain points at the wrong service/port | Add a Domain → service `web`, port `3000` (§5). |
| Browser bundle shows Supabase URL/key error | Build-time `NEXT_PUBLIC_*` not passed into the **build** step | See §4.1 — ensure the panel env reaches `docker compose build`. |

---

## 8. Redeploys & updates

- Push to `main`; trigger a redeploy in Dokploy (or enable auto-deploy on push).
- **Changing a build-time var** (`NEXT_PUBLIC_*`) requires a **rebuild** to
  re-inline it — a runtime restart alone won't pick it up.
- **Schema changes**: apply new `supabase/migrations/*.sql` to the Supabase
  project (managed: dashboard/CLI; self-host: `psql`/CLI) **before or with** the
  app deploy that depends on them. `supabase/seed.sql` is one-time (idempotent —
  safe to re-run, but never needed after the first deploy).

---

## 9. Pre-launch checklist

- [ ] Migrations `0000a`–`0040` applied to the target Supabase project
- [ ] `supabase/seed.sql` run once (settings singleton; see its comments for the
      first-admin bootstrap + `app_secret` steps)
- [ ] Build-time `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set and reaching the build
- [ ] Runtime `NEXT_PUBLIC_SITE_URL` = real HTTPS origin
- [ ] Domain added → service `web`, port `3000`, HTTPS on
- [ ] Supabase Site URL + redirect allowlist off `localhost`
- [ ] Google OAuth enabled in Supabase (if used)
- [ ] Auth email templates applied
- [ ] Resend domain verified + `RESEND_API_KEY`/`EMAIL_FROM` set (if email wanted)
- [ ] Smoke test: home renders · sign-in works · a COD order places · `/admin` loads
- [ ] Backups configured (managed = automatic; self-host = your `pg_dump`)

---

## 10. Notes & known follow-ups

- The in-memory rate limiter (4.10) is **per-instance**; a multi-replica deploy
  needs a shared store (tracked under 4.13/L5). Single instance is fine for now.
- Observability (error tracking / uptime) is not yet wired (4.11) — production
  incidents are currently only visible in Dokploy container logs.
- E2E tests write real orders to the live DB; use a staging project before wiring
  CI against a deployed host (4.12).

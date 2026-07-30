# Deployment & Release Plan — RJ Jewellers

The end-to-end operating model for shipping this app: branching, environments,
CI/CD, database change management, secrets, release procedure, rollback, and
disaster recovery. This is the **process** document; the **mechanics** of a
single Dokploy deploy live in [`DEPLOY_DOKPLOY.md`](./DEPLOY_DOKPLOY.md).

Work items referenced here are tracked in `TASKS.md` Phase 8:
**8.1** email deliverability · **8.2** finish prod deploy · **8.3** observability ·
**8.4** CI · **8.5** backups + restore drill · **8.21** staging + release discipline.

---

## 1. Branching model — trunk-based with a promotion branch

Solo-maintainer project → **trunk-based development**, not GitFlow (no
`develop`, no release branches — that ceremony buys nothing here).

| Branch | Role | Deploys to |
|---|---|---|
| `main` | Trunk. Always green, always deployable. | **Staging** (auto, on push) |
| `production` | Promotion pointer. Only ever fast-forwarded from `main`. | **Production** (auto, on push) |
| `feat/*` `fix/*` `chore/*` | Short-lived work branches (hours–days, not weeks) | — (CI only) |

Rules:

- **All work lands on `main` via PR** from a short-lived branch. Squash-merge;
  the squash title follows the conventional-commit format already in use
  (`feat:`, `fix:`, `docs:`, …).
- **`main` is protected** (GitHub → Settings → Branches): require the CI check
  to pass, block force-push and deletion. Solo caveat: don't require reviews
  (there's no second reviewer); the gate is CI, not eyeballs.
- **Promotion = fast-forward**: `git checkout production && git merge --ff-only main && git push`.
  A production deploy is therefore always a commit that already survived CI
  *and* baked on staging. Never commit directly to `production`.
- **Tag every production promotion**: `git tag -a v0.X.Y -m "…" && git push --tags`.
  Semver-ish is fine pre-1.0: minor = feature batch, patch = fix. Tags are the
  rollback vocabulary (§7) and the changelog skeleton.
- **Hotfix path**: same as normal — branch off `main`, PR, CI, promote. Only if
  `main` contains unbaked work you don't want to ship, branch off `production`
  (`hotfix/*`), PR into `production`, then cherry-pick back to `main`. Expect
  this to be rare; prefer keeping `main` shippable so it never happens.

## 2. Environment topology

Three environments, two of them deployed. **The same Docker image mechanics
serve staging and prod; only env vars and the Supabase project differ.**

| | Local dev | Staging | Production |
|---|---|---|---|
| App | `bun dev` on :3000 | Dokploy app `web-staging`, branch `main` | Dokploy app `web`, branch `production` |
| Domain | localhost | `staging.<domain>` (Let's Encrypt) | `<domain>` (Let's Encrypt) |
| Supabase | staging project | **staging project** (new, to create — 8.21) | existing project `naolegptozpaiojozzcy` |
| Email | no `RESEND_API_KEY` → no-op | Resend, `EMAIL_FROM` on the verified domain, sends restricted to test inboxes | Resend, verified domain (8.1) |
| Crons | not registered | registered, staging `CRON_SECRET` | registered, **distinct** `CRON_SECRET` (8.2) |
| Robots | n/a | `noindex` (see below) | indexable |

Decisions baked into this layout:

- **The existing Supabase project becomes production.** It was reset to
  fresh-deploy state on 2026-07-08 and the operator has re-bootstrapped the
  admin — it's already the cleanest "prod day zero" we have. Staging gets a
  **new** project: apply migrations `0000a`–latest in filename order, run
  `supabase/seed.sql`, bootstrap a staging admin, insert the staging
  `app_secret` cron row.
- **E2E and dev point at staging, never prod.** Playwright checkout E2E writes
  real orders (documented in TASKS cross-cutting notes) — retarget
  `.env.local` and CI E2E secrets to the staging project the day it exists.
  From that day, treat prod Supabase credentials as deploy-only.
- **Staging must not be indexed or mistaken for the store.** The sitemap/robots
  derive from `NEXT_PUBLIC_SITE_URL`; that alone doesn't stop crawlers on a
  reachable subdomain. Add one of: Traefik basic-auth on the staging domain
  (Dokploy supports per-domain middleware), or an `X-Robots-Tag: noindex`
  response header for the staging deployment. Basic-auth preferred — it also
  keeps testers-only.
- **Branch-per-environment is what makes Dokploy CD safe**: `web-staging`
  auto-deploys on push to `main`, `web` auto-deploys on push to `production`.
  No manual "which build is live?" ambiguity.

## 3. CI — GitHub Actions (Phase 8.4)

One workflow, `.github/workflows/ci.yml`, on `pull_request` and `push` to
`main`/`production`:

```
bun install --frozen-lockfile
bunx tsc --noEmit
bun run lint
bun test              # unit suite
bun run build         # prod build must compile
```

- This exact sequence is the branch-protection **required check** on both
  protected branches.
- **E2E job** (Playwright checkout + visual regression): separate job, gated —
  run on a PR label (`e2e`) and on every push to `production` (pre-promotion
  confidence). Needs secrets: staging `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (E2E writes orders → **staging only**).
  Upload traces/screenshots as artifacts on failure.
- Cache `~/.bun/install/cache` keyed on `bun.lock` to keep runs fast.
- CI is **verification only** — deployment stays Dokploy's job (webhook on
  push). Don't build/push images from Actions; the Dokploy host builds from
  the compose file, which is the already-debugged path.

## 4. Database change management

The DB is the riskiest surface — migrations are irreversible in practice and
the app and schema deploy through **different pipelines** (Supabase vs Dokploy).
Rules, in order of importance:

1. **Migrations first, code second.** Apply new `supabase/migrations/*.sql`
   to the target project **before** deploying the app version that needs them.
   The 7.6 `email_copy` incident is the canonical failure: code reading a
   column that doesn't exist yet. The reverse order is never correct here.
2. **Which means: expand → migrate → contract.** New columns/tables must be
   additive and tolerated by the *currently running* app version (nullable,
   defaulted). Destructive steps (drop/rename) ship only after the code that
   stopped using them is live.
3. **Staging rehearsal is mandatory**: every migration runs on the staging
   project (and gets exercised by the staging app) before it touches prod.
4. **Backup before prod migration**: take/verify a `pg_dump` (or confirm the
   latest scheduled one, §8) immediately before applying. Rollback for a bad
   migration is roll-*forward* (a correcting migration) or restore — there is
   no `down` path.
5. **One numbered file per change, never edit an applied migration.** Already
   the repo convention (`0000a`–`0042`); keep filename-order = apply-order.
6. **`seed.sql` is per-environment, once.** It creates the `setting` singleton
   (without it every Settings save fails with `SETTINGS_ROW_MISSING`) and
   documents admin bootstrap + `app_secret`. Idempotent, but part of
   environment provisioning, not of releases.
7. Track applied state per environment (Supabase `list_migrations` / a note in
   the release log) so "what's pending on prod?" is a lookup, not archaeology.

## 5. Configuration & secrets

- **Source of truth per environment is the Dokploy Environment panel** (plus
  GitHub Actions secrets for CI E2E). Nothing secret in the repo — `.env.local`
  is gitignored; `.env.example` stays the documented catalogue of every var.
- **Build-time vs runtime matters**: `NEXT_PUBLIC_*` is inlined at image build
  (compose `build.args`) — changing one requires a **rebuild**, not a restart
  (DEPLOY_DOKPLOY §4.1, §8).
- Per-environment values that must **differ** between staging and prod:
  `CRON_SECRET` (+ matching `app_secret` DB row each), all Supabase URL/keys,
  `NEXT_PUBLIC_SITE_URL`, VAPID key pair, `ADMIN_ALERT_EMAIL` (staging → a
  test inbox so digest tests don't spam the operator).
- **Secret rotation runbook** (write once, per 8.2): rotating
  `SUPABASE_SECRET_KEY`, `SMTP_PASS`, or `CRON_SECRET` = update panel →
  redeploy (runtime vars only, no rebuild) → for `CRON_SECRET`, update the
  `app_secret` row in the same window.
- Full variable reference: DEPLOY_DOKPLOY §4 and `.env.example`.

## 6. Release procedure (the standard path)

Cadence: release when a coherent batch is baked — for this project that's
typically "a TASKS item or three", not a calendar. Prefer small, frequent
promotions; avoid deploying during IST evening peak shopping hours.

1. **Land work on `main`** via PR; CI green. Staging auto-deploys.
2. **Apply pending migrations to staging** (if the batch has any), in order.
3. **Bake on staging**: click through the touched surfaces; run the E2E job
   (label the PR or trigger the workflow) against staging.
4. **Pre-promotion gate** — all yes:
   - [ ] CI green on the `main` commit being promoted
   - [ ] Pending migrations applied + exercised on staging
   - [ ] E2E (checkout journey) green against staging
   - [ ] Prod backup current (§8) if migrations are shipping
5. **Apply pending migrations to prod** (expand-safe per §4.2, so the running
   old version keeps working).
6. **Promote**: `git checkout production && git merge --ff-only main && git push`
   → Dokploy `web` auto-deploys. Tag: `git tag -a v0.X.Y && git push --tags`.
7. **Prod smoke test** (5 minutes, every release):
   - [ ] Home renders; no CSP violations in console
   - [ ] Product page → add to cart → cart
   - [ ] Sign-in works
   - [ ] `/admin` loads behind the gate (unauth → redirect)
   - [ ] If checkout-adjacent code shipped: place a real COD order, verify the
         confirmation email, then cancel it via admin (keeps books clean)
8. **Log it**: one line in the release notes (tag message is enough) — what
   shipped, migrations applied, anything skipped.

## 7. Rollback

- **App rollback** (bad deploy, schema unchanged): reset the pointer —
  `git checkout production && git reset --hard <previous-tag> && git push --force-with-lease`
  → Dokploy rebuilds the old commit. (`production` is the *one* branch where a
  forced pointer move is legitimate — it's a deploy pointer, not history.)
  Alternatively redeploy the previous build from Dokploy's deployment history
  if the image is still on the host — faster, same result.
- **Schema rollback does not exist.** A migration that shipped broken gets a
  **forward-fixing migration**; catastrophic data damage gets a restore (§8).
  This asymmetry is *why* §4's expand-first rule exists: it keeps app rollback
  possible even when a migration has already been applied.
- **Env-var mistakes**: runtime vars → fix in panel + restart; `NEXT_PUBLIC_*`
  → fix + rebuild.
- After any rollback, open a TASKS item for the root cause before re-promoting.

## 8. Backups & disaster recovery (Phase 8.5)

Order data loss is existential for a store. Minimum bar:

- **Database**: nightly `pg_dump` of the prod project from a cron on the
  Dokploy host, retained ~30 days, synced off-host (object storage / even a
  second machine). If the Supabase Pro tier is adopted, PITR supplements but
  does not replace the off-site dump.
- **Storage buckets** (`product`, `category` images): nightly sync to the same
  off-site target.
- **Restore drill — run once, before launch, then quarterly**: restore the
  latest dump into a scratch project, point a local app at it, verify orders/
  products/settings are intact. A backup that has never been restored is a
  hope, not a backup. Document the exact commands as `docs/RESTORE.md` while
  doing the drill (8.5's deliverable).
- **Config DR**: keep an exported copy of the Dokploy env panels (encrypted,
  off-host) so a dead host can be rebuilt from repo + env export + DB dump.

## 9. Observability & release health (Phase 8.3)

A release isn't "done" at deploy; it's done when you can see it misbehave:

- **Error tracking**: Sentry or self-hosted GlitchTip (matches the Dokploy
  posture), server + client, with the CSP nonce accounted for. Tag events with
  the release (git SHA / tag) so "which deploy broke it" is a filter.
- **Uptime**: external monitor on `/` and one API route, alerting the operator
  (email/WhatsApp).
- **Silent failures made loud**: queued email send failures and cron-route
  non-200s (`daily-digest`, `abandoned-carts` already return 5xx on misfire)
  must reach the error tracker, not just container logs.
- **Post-release watch**: after each promotion, 10 minutes on the error
  tracker + Dokploy logs before walking away.

## 10. Sequencing — from here to the operating model

Everything above lands through existing Phase 8 items, in this order:

1. **8.4 CI + branch protection** — cheapest, highest leverage; protects every
   later step. Includes creating the `production` branch (starts at today's
   `main`) and both protection rules.
2. **8.21 staging** — new staging Supabase project (migrations + seed + admin
   bootstrap) + Dokploy `web-staging` on `main` + staging domain with
   basic-auth; retarget dev/E2E creds to it.
3. **8.1 + 8.2 go-live** — Resend domain verification, real domain → Dokploy
   `web` (switched to the `production` branch), full prod env, crons, then the
   DEPLOY_DOKPLOY §9 pre-launch checklist end-to-end.
4. **8.5 backups + restore drill** — before real orders accumulate.
5. **8.3 observability** — same week as launch, not after.

First production promotion happens at step 3 via the §6 procedure, which then
becomes the standing release path.

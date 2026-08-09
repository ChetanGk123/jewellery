# Handbook

The store operator's manual — a [Mintlify](https://mintlify.com) site covering
every screen in the admin console, written for a non-technical reader.

Distinct from [`docs/`](../docs), which is developer/deployment documentation.

## Preview locally

```bash
bun run handbook          # http://localhost:3333
```

Pinned to **3333** so it can run alongside `bun run dev` (the app takes 3000) —
handy for checking a page against the console screen it describes.

```bash
cd handbook && npx mint broken-links
```

## Structure

- `docs.json` — theme, colours, and the navigation (every page must be listed
  here or it won't appear).
- `*.mdx` — one file per page, grouped into `selling/`, `catalogue/`,
  `insight/`, `setup/`.

## Running it in production

Three options. **Everything below is a documented recipe, not a verified one —
no deployment exists yet.** The local facts they rest on *are* verified.

The one constraint that shapes all of them: **Mintlify emits root-absolute
links** (`/glossary`, `/_next/*`) in both `mint dev` and `mint export`, and has
no base-path flag. So the handbook is happy at the **root of its own hostname**,
and needs Mintlify's hosted "Host at" mode to live under a subpath.

### Option 1 — Mintlify hosted, own subdomain (least work)

1. Install the [Mintlify GitHub app](https://mintlify.com/docs/deployment) on
   this repo, docs directory `handbook`.
2. Add `docs.<your-domain>` as a custom domain in the Mintlify dashboard
   (or `npx mint add-domain`), and point a DNS CNAME at it.

Nothing changes in this app — no rewrite, no env var. Every push to `main`
redeploys. Links work because the site sits at a host root.

### Option 2 — Mintlify hosted, served at `<your-domain>/docs`

Option 1, plus:

3. Dashboard → Custom Domain → enable **Host at**, set `<your-domain>/docs`.
4. Set `HANDBOOK_ORIGIN` to the Mintlify deployment origin — as a **build arg**,
   not a runtime variable. `rewrites()` runs during `next build` and bakes the
   origin into `.next/routes-manifest.json`, so a value supplied only at
   `docker run` is silently ignored and `/docs` stays unrouted. Compose passes it
   via `build.args`; on Dokploy, put it where build-time env is set and
   **rebuild** — a restart won't pick it up.

The app then reverse-proxies it — see `rewrites()` in `next.config.ts`. Step 3
is not optional: it is what makes Mintlify emit `/docs/...` links and move its
assets to `/mintlify-assets/*` + `/_mintlify/*`. Without it you get a page that
renders and then 404s its own scripts.

### Option 3 — Self-hosted static export (no Mintlify hosting)

```bash
bun run handbook:export      # → handbook-static.zip
```

Unzip it and serve the folder as static files at the **root of a hostname** —
e.g. a second Dokploy service (`nginx:alpine` with the folder mounted at
`/usr/share/nginx/html`) routed by Traefik to `docs.<your-domain>`.

Verified locally: served at a root, all 20 pages and every asset resolve.
No external hosting, no proxy, no plan needed — but the export is a manual step,
so it goes stale unless you re-run it when the handbook changes.

### Which

**Option 1** unless you specifically want the docs on the store's own domain
(then 2), or want zero external dependencies (then 3).

### Also do this before launch

Replace `https://YOUR-STORE-DOMAIN/admin` in `docs.json` — it's the navbar's
"Open the console" button.

## Serving it at `/docs` on the app's origin

`rewrites()` in `next.config.ts` reverse-proxies the handbook onto the app, so
it reads as one site.

**In dev, `/docs` is a redirect**, not a proxy: `localhost:3000/docs` sends you
to the handbook server on :3333. `mint dev` serves from root and emits
root-relative links (`/glossary`, `/selling/orders`) with no base-path option —
so proxying it under `/docs` renders the page but drops every link into the
storefront's `[category]` catch-all. The redirect keeps navigation working and
the URL honest.

**In production**, set `HANDBOOK_ORIGIN` to the Mintlify deployment origin *and*
enable **Host at → `<your-domain>/docs`** in the Mintlify dashboard → Custom
Domain. The env var alone is not enough: "Host at" is what moves Mintlify's
assets to `/mintlify-assets/*` and `/_mintlify/*`, and shifts its pages under
`/docs`, which is what the rewrite expects in that mode.

### Why the production rewrite is split across `beforeFiles` and `fallback`

Three collisions, all real:

- **Links vs the base path.** Mintlify has to emit `/docs/...` links itself —
  no proxy can retrofit them, because they live in its client bundle as well as
  its HTML. That is exactly what "Host at" does, and why local dev redirects
  instead.
- **`/docs` vs the storefront.** The app has a `[category]` catch-all that
  answers any single-segment path, so `/docs` would render "Category not found".
  The `/docs` rewrites sit in **`beforeFiles`**, ahead of dynamic routing.
- **`/_next/*` vs `/_next/*`.** Mintlify is itself a Next app, so its assets
  share this app's namespace. Those rewrites sit in **`fallback`**, which only
  fires when this app has no such route — so every real app chunk is served by
  the app, and only Mintlify's unresolved ones proxy through.

A blanket rewrite of `/_next/*` would break the app. Don't flatten these into
one list.

## Keeping it true

The pages describe real buttons and labels. When a console screen changes its
wording or its flow, update the matching page in the same commit — a handbook
that describes a button that no longer exists is worse than no handbook.

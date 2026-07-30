# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# JR Jewellers — production image for the Next.js 16 (App Router) storefront +
# admin console. Multi-stage build on Bun (the project's package manager) with
# Next.js `output: "standalone"` so the runtime image ships only a pruned
# server.js + traced node_modules.
#
# Base is Debian-slim (glibc), NOT alpine: `sharp` (a trustedDependency, built
# during install for Next.js image optimization) needs a consistent libc between
# the build and runtime stages.
#
# NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD time, so they
# must be passed as build args — they cannot be injected at `docker run`. The
# server-only SUPABASE_SECRET_KEY is a pure runtime var (passed at `docker run`).
# ─────────────────────────────────────────────────────────────────────────────

ARG BUN_VERSION=1.3.11

# ── deps: install node_modules from the frozen lockfile ──────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
# Cache mount survives image rebuilds, so a lockfile change re-resolves against
# already-downloaded tarballs instead of refetching the whole dependency set.
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

# ── builder: compile the standalone Next.js server ───────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS builder
WORKDIR /app

# Public Supabase config — inlined into the client bundle and validated by
# lib/env.ts during `next build`, so real values are required here.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# Also build-time: `NEXT_PUBLIC_SITE_URL` is inlined by the compiler like any
# other NEXT_PUBLIC_* var, so passing it only at `docker run` is too late —
# sitemap.xml / robots.txt / metadataBase would bake in the localhost fallback.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

# `tsc` is not run inside the image — see next.config.ts. CI (and any local
# `bun run build`) still type-checks; doing it again here just re-pays ~112s of
# the deploy on a 3-core box to learn what CI already proved.
ENV SKIP_TYPE_CHECK=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `.next/cache` holds Turbopack's persistent compile cache (and tsc's
# .tsbuildinfo). `.next` is gitignored *and* dockerignored, so this mount is its
# only source — it turns each deploy's full recompile into an incremental one.
# `sharing=locked` serialises concurrent builds rather than letting two writers
# corrupt the cache. Deleting the mount only costs one slow build.
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked \
    bun run build

# ── runner: minimal runtime with a non-root user ─────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as an unprivileged user (the bun image ships a `bun` uid 1000 account).
COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static

USER bun
EXPOSE 3000

# Standalone emits server.js at the app root; Next reads PORT/HOSTNAME from env.
CMD ["bun", "server.js"]

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
RUN bun install --frozen-lockfile

# ── builder: compile the standalone Next.js server ───────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS builder
WORKDIR /app

# Public Supabase config — inlined into the client bundle and validated by
# lib/env.ts during `next build`, so real values are required here.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

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

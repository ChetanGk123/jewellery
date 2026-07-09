import "server-only"
import { after } from "next/server"
import webpush from "web-push"
import { z } from "zod"
import { SITE_URL } from "@/lib/site-url"

/**
 * Web Push to the admins' subscribed devices (6.17) — system notifications
 * for new orders, cancellations, contact messages and reviews, delivered even
 * when the browser is closed (and on installed-PWA mobile).
 *
 * Mirrors lib/email/send.ts: degrades to a no-op when the VAPID keys aren't
 * configured (local dev, CI), queues behind `after()` so customers never wait
 * on push delivery, and logs-never-throws — a push hiccup must not fail an
 * already-placed order.
 *
 * Subscriptions live in the sealed `push_subscription` table (0038). Events
 * fire under anon/customer sessions, so the sender reads the list through the
 * cron-secret-gated `get_push_subscriptions` RPC — the same shared-secret
 * pattern as the daily digest — and prunes endpoints the push service reports
 * dead (404/410).
 */

export type AdminPushPayload = {
  title: string
  body: string
  /** Path the notification opens when tapped, e.g. /admin/orders. */
  url: string
  /** Collapse key: notifications with the same tag replace each other. */
  tag?: string
}

/** Give up on undelivered notifications after a day — stale pings are noise. */
const PUSH_TTL_SECONDS = 24 * 60 * 60

const subscriptionsSchema = z.array(
  z.object({
    endpoint: z.string().min(1),
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
)

/** True when push can actually send (drives the Settings card copy too). */
export function isPushEnabled(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.CRON_SECRET,
  )
}

/** The public key the browser subscribes against (safe to expose). */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null
}

/** Outcome of one send — the queued callers ignore it; the test button shows it. */
export type PushSendReport = {
  delivered: number
  /** Subscribed devices attempted. */
  total: number
  /** Human-readable reason when nothing could be attempted at all. */
  error?: string
}

/**
 * Send one payload to every subscribed admin device, then prune dead
 * subscriptions. Best-effort throughout — logs, never throws.
 */
export async function sendAdminPushNow(payload: AdminPushPayload): Promise<PushSendReport> {
  if (!isPushEnabled()) {
    return {
      delivered: 0,
      total: 0,
      error:
        "Push isn't fully configured — VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and CRON_SECRET must all be set on the server.",
    }
  }

  try {
    // Imported lazily: lib/db/public validates env at module load, which the
    // disabled path (unit tests, dev without keys) must never require.
    const { publicClient } = await import("@/lib/db/public")
    const secret = process.env.CRON_SECRET as string
    const { data, error } = await publicClient.rpc("get_push_subscriptions", {
      p_secret: secret,
    })
    if (error) {
      console.error("push: could not load subscriptions", error.message)
      return {
        delivered: 0,
        total: 0,
        error:
          "The server couldn't read push subscriptions — check that the app_secret 'cron' row matches CRON_SECRET (see migration 0029).",
      }
    }

    const parsed = subscriptionsSchema.safeParse(data)
    if (!parsed.success) {
      return { delivered: 0, total: 0, error: "Subscription list was malformed." }
    }
    if (parsed.data.length === 0) {
      return { delivered: 0, total: 0, error: "No devices are subscribed on the server." }
    }

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? SITE_URL,
      process.env.VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string,
    )

    const body = JSON.stringify(payload)
    const results = await Promise.allSettled(
      parsed.data.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: PUSH_TTL_SECONDS, urgency: "high" },
        ),
      ),
    )

    const dead: string[] = []
    let delivered = 0
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        delivered += 1
        return
      }
      const status = statusCodeOf(result.reason)
      // 404/410: the browser rotated or expired the subscription — drop it.
      if (status === 404 || status === 410) {
        dead.push(parsed.data[i].endpoint)
      } else {
        console.error("push: send failed", status ?? "", result.reason)
      }
    })

    if (dead.length > 0) {
      const { error: pruneError } = await publicClient.rpc("prune_push_subscriptions", {
        p_secret: secret,
        p_endpoints: dead,
      })
      if (pruneError) console.error("push: prune failed", pruneError.message)
    }

    return { delivered, total: parsed.data.length }
  } catch (error: unknown) {
    console.error("push: send failed", error)
    return { delivered: 0, total: 0, error: "Sending failed unexpectedly — see server logs." }
  }
}

function statusCodeOf(reason: unknown): number | null {
  if (reason && typeof reason === "object" && "statusCode" in reason) {
    const code = (reason as { statusCode: unknown }).statusCode
    if (typeof code === "number") return code
  }
  return null
}

/**
 * Schedule a push to run after the response is flushed (`after()`) — same
 * shape as the email queue. Falls back to a detached send outside a request
 * scope (unit tests). Never throws.
 */
export function queueAdminPush(payload: AdminPushPayload): void {
  if (!isPushEnabled()) return
  try {
    after(() => sendAdminPushNow(payload))
  } catch {
    void sendAdminPushNow(payload)
  }
}

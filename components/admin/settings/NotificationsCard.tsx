"use client"

import { useEffect, useState, useTransition } from "react"
import {
  deletePushSubscription,
  type PushSendReport,
  savePushSubscription,
  sendTestPushNotification,
} from "@/app/(admin)/admin/(console)/settings/actions"
import { SectionCard } from "./SectionCard"

type Props = {
  /** VAPID public key from the server; null when push isn't configured. */
  vapidPublicKey: string | null
  /** True only when the server can actually send (all push env vars present). */
  isConfigured: boolean
}

type PushState =
  | "checking" // reading browser support + current subscription on mount
  | "unsupported" // browser lacks service workers / Push API (e.g. iOS Safari tab)
  | "blocked" // the admin denied the notification permission for this site
  | "off"
  | "on"

const SW_PATH = "/sw.js"

/**
 * Settings → Notifications (6.17): enable system push notifications for this
 * device. Per-device by nature — the browser's push subscription is tied to
 * this browser profile — so each machine/phone the operator uses opts in
 * separately. iPhones additionally need the site installed via Share → Add to
 * Home Screen (Apple only allows Web Push for installed web apps).
 */
export function NotificationsCard({ vapidPublicKey, isConfigured }: Props) {
  const [state, setState] = useState<PushState>("checking")
  const [error, setError] = useState<string | null>(null)
  const [testReport, setTestReport] = useState<PushSendReport | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return "unsupported" as const
      }
      if (Notification.permission === "denied") return "blocked" as const
      const registration = await navigator.serviceWorker.getRegistration(SW_PATH)
      const subscription = await registration?.pushManager.getSubscription()
      return subscription ? ("on" as const) : ("off" as const)
    }
    check()
      .then((next) => {
        if (!cancelled) setState(next)
      })
      .catch(() => {
        if (!cancelled) setState("unsupported")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const enable = () => {
    if (!vapidPublicKey) return
    setError(null)
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
          setState(permission === "denied" ? "blocked" : "off")
          return
        }

        const registration = await navigator.serviceWorker.register(SW_PATH)
        await navigator.serviceWorker.ready
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }))

        const json = subscription.toJSON()
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          throw new Error("subscription missing keys")
        }
        const res = await savePushSubscription({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          userAgent: navigator.userAgent.slice(0, 400),
        })
        if (!res.ok) throw new Error(res.error)
        setState("on")
      } catch {
        setError("Couldn't enable notifications on this device. Please try again.")
      }
    })
  }

  const sendTest = () => {
    setError(null)
    setTestReport(null)
    startTransition(async () => {
      const report = await sendTestPushNotification()
      setTestReport(report)
    })
  }

  const disable = () => {
    setError(null)
    setTestReport(null)
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration(SW_PATH)
        const subscription = await registration?.pushManager.getSubscription()
        if (subscription) {
          await deletePushSubscription(subscription.endpoint)
          await subscription.unsubscribe()
        }
        setState("off")
      } catch {
        setError("Couldn't disable notifications on this device. Please try again.")
      }
    })
  }

  return (
    <SectionCard
      id="notifications"
      iconBg="#F7E9E0"
      icon={<BellIcon />}
      title="Notifications"
      subtitle="System alerts for orders, cancellations, messages and reviews"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-[30px] py-[26px] max-sm:px-5">
        <div className="min-w-0 max-w-[560px]">
          <div className="font-body text-[14px] font-semibold text-[#2B2420]">
            Push notifications on this device
          </div>
          <p className="m-0 mt-1 font-body text-[12.5px] leading-relaxed text-[#8B8177]">
            Get a system notification the moment a customer places or cancels an order, sends a
            message, or leaves a review — even when the browser is closed. Enable it on each
            device you use. On iPhone, first add this site to your Home Screen (Share → Add to
            Home Screen), then enable from there.
          </p>
          <StatusLine state={state} isConfigured={isConfigured} />
          {error && (
            <p role="alert" className="m-0 mt-2 font-body text-[12.5px] font-medium text-[#C0392F]">
              {error}
            </p>
          )}
          {testReport && (
            <p
              role="status"
              className="m-0 mt-2 font-body text-[12.5px] font-medium"
              style={{ color: testReport.delivered > 0 ? "#3E8552" : "#C0392F" }}
            >
              {testReport.delivered > 0
                ? `Test sent to ${testReport.delivered} of ${testReport.total} device${testReport.total === 1 ? "" : "s"} — if you didn't see it, check your system notification settings for this browser (and Focus/Do Not Disturb).`
                : (testReport.error ?? "The test couldn't be delivered to any device.")}
            </p>
          )}
        </div>
        {state === "on" ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={sendTest}
              disabled={isPending || !isConfigured}
              className="rounded-lg bg-[#5B1A2E] px-5 py-[11px] font-body text-[13px] font-semibold text-[#F7EDE3] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? "Working…" : "Send a test"}
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={isPending}
              className="rounded-lg border border-[#DAD0C2] bg-white px-5 py-[11px] font-body text-[13px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
            >
              Disable on this device
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={
              isPending ||
              state === "checking" ||
              state === "unsupported" ||
              state === "blocked" ||
              vapidPublicKey === null ||
              !isConfigured
            }
            className="shrink-0 rounded-lg bg-[#5B1A2E] px-5 py-[11px] font-body text-[13px] font-semibold text-[#F7EDE3] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Enabling…" : "Enable on this device"}
          </button>
        )}
      </div>
    </SectionCard>
  )
}

function StatusLine({ state, isConfigured }: { state: PushState; isConfigured: boolean }) {
  if (!isConfigured) {
    return (
      <p className="m-0 mt-2 font-body text-[12.5px] font-medium text-[#B4863A]">
        Not configured yet — set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and CRON_SECRET on the
        server to turn this on.
      </p>
    )
  }
  if (state === "unsupported") {
    return (
      <p className="m-0 mt-2 font-body text-[12.5px] font-medium text-[#B4863A]">
        This browser doesn&apos;t support push notifications. On iPhone, open the site from your
        Home Screen after adding it there.
      </p>
    )
  }
  if (state === "blocked") {
    return (
      <p className="m-0 mt-2 font-body text-[12.5px] font-medium text-[#B4863A]">
        Notifications are blocked for this site — allow them in your browser&apos;s site settings,
        then try again.
      </p>
    )
  }
  if (state === "on") {
    return (
      <p role="status" className="m-0 mt-2 font-body text-[12.5px] font-medium text-[#3E8552]">
        Notifications are on for this device.
      </p>
    )
  }
  return null
}

/** Decode the base64url VAPID key into the BufferSource subscribe() expects. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 16v-5a6 6 0 10-12 0v5l-1.5 2.5h15z"
        stroke="#5B1A2E"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <path d="M10 20.5a2 2 0 004 0" stroke="#5B1A2E" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  )
}

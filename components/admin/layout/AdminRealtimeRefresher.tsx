"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/db/client"

/**
 * Live console (6.9): re-render the admin's server components when an order,
 * review, or contact message changes, instead of waiting for a manual reload.
 * Subscribes to postgres_changes (tables published in 0034; Realtime enforces
 * the is_admin() RLS read policies per subscriber, so non-admin sessions
 * receive nothing) and coalesces bursts into one debounced router.refresh() —
 * a checkout inserts the order + its items and fires the audit trigger in
 * quick succession; one refresh covers all of it.
 */

const REFRESH_DEBOUNCE_MS = 1200

/** The tables whose changes should repaint the console (queue + bell counts). */
const WATCHED_TABLES = ["order", "review", "contact_message"] as const

export function AdminRealtimeRefresher() {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS)
    }

    let channel = supabase.channel("admin-console-live")
    for (const table of WATCHED_TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh)
    }
    channel.subscribe()

    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [router])

  return null
}

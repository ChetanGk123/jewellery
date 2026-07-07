"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { normalizeOrderNote } from "@/lib/admin/order-notes";
import { CACHE_TAGS } from "@/lib/db/cache";
import {
  getAllOrdersForExport,
  ORDER_STATUSES,
  toOrderEvent,
  type ExportOrderRow,
  type OrderEvent,
} from "@/lib/db/admin-orders";
import { createServerClient } from "@/lib/db/server";
import type { OrderStatusEmailKind } from "@/lib/email/order-status";
import { queueOrderStatusEmail } from "@/lib/email/send";
import { ROUTES } from "@/lib/routes";

export type StatusActionResult = { ok: boolean; error?: string };

const VALID = new Set<string>(ORDER_STATUSES);

/** The statuses that notify the customer by email (TASKS 5.2). */
const NOTIFY = new Set<string>(["Shipped", "Delivered", "Cancelled"]);

/** Friendly messages for the RPC's raised exceptions (see 0007). */
function messageFor(raw: string): string {
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that.";
  if (raw.includes("ORDER_NOT_FOUND")) return "That order no longer exists.";
  if (raw.includes("ORDER_TERMINAL"))
    return "This order is already delivered or cancelled.";
  if (raw.includes("INVALID_TRANSITION"))
    return "That status change isn't allowed from here.";
  return "Couldn't update the order. Please try again.";
}

/**
 * Advance an order one step (or cancel it) via the admin-only
 * `admin_set_order_status` RPC (0007). The RPC re-checks admin + the transition
 * rules server-side; this action adds the authoritative `requireAdmin` gate and
 * a light input guard, then revalidates the queue so the new status shows.
 */
export async function setOrderStatus(
  orderId: string,
  nextStatus: string,
): Promise<StatusActionResult> {
  await requireAdmin(ROUTES.adminOrders);

  if (!orderId || !VALID.has(nextStatus)) {
    return { ok: false, error: "Invalid status change." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("admin_set_order_status", {
    p_order_id: orderId,
    p_status: nextStatus,
  });

  if (error) {
    return { ok: false, error: messageFor(error.message) };
  }

  // Notify the customer on the statuses that matter to them (TASKS 5.2).
  // Best-effort: read the order authoritatively (admin RLS) and queue — an
  // email hiccup must never fail an already-applied status change.
  if (NOTIFY.has(nextStatus)) {
    const { data: order } = await supabase
      .from("order")
      .select("order_no, customer_email, customer_name, total_paise")
      .eq("id", orderId)
      .maybeSingle();
    if (order?.customer_email) {
      queueOrderStatusEmail({
        to: order.customer_email,
        kind: nextStatus as OrderStatusEmailKind,
        orderNo: order.order_no,
        customerName: order.customer_name,
        totalPaise: order.total_paise,
      });
    }
  }

  revalidatePath(ROUTES.adminOrders);
  // A Cancel restores stock, which the cached catalog displays.
  updateTag(CACHE_TAGS.products);
  return { ok: true };
}

/**
 * Every order for the CSV export (TASKS 5.18) — the list itself paginates, so
 * this reads the lot on demand behind the admin gate, capped in the db layer.
 */
export async function exportOrders(): Promise<ExportOrderRow[]> {
  await requireAdmin(ROUTES.adminOrders);
  return getAllOrdersForExport();
}

export type NoteActionResult = {
  ok: boolean;
  /** The saved timeline entry, so the open drawer can append it in place. */
  event?: OrderEvent;
  error?: string;
};

/** Friendly messages for `admin_add_order_note`'s raised exceptions (0028). */
function noteMessageFor(raw: string): string {
  if (raw.includes("NOT_ADMIN")) return "You don't have permission to do that.";
  if (raw.includes("ORDER_NOT_FOUND")) return "That order no longer exists.";
  if (raw.includes("INVALID_NOTE"))
    return "Notes must be 1–500 characters.";
  return "Couldn't save the note. Please try again.";
}

/**
 * Attach an internal note to an order (TASKS 5.16). Writes an `order.note`
 * row into the audit log via the admin-only `admin_add_order_note` RPC, which
 * re-checks admin + validity server-side; returns the created event so the UI
 * updates without a refetch.
 */
export async function addOrderNote(
  orderNo: string,
  rawNote: string,
): Promise<NoteActionResult> {
  await requireAdmin(ROUTES.adminOrders);

  const note = normalizeOrderNote(rawNote);
  if (!orderNo || !note) {
    return { ok: false, error: "Notes must be 1–500 characters." };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("admin_add_order_note", {
    p_order_no: orderNo,
    p_note: note,
  });

  if (error) {
    return { ok: false, error: noteMessageFor(error.message) };
  }

  const row = data as {
    id?: string;
    actor_email?: string | null;
    summary?: string | null;
    created_at?: string;
  } | null;
  if (!row?.id || !row.created_at) {
    return { ok: false, error: "Couldn't save the note. Please try again." };
  }

  revalidatePath(ROUTES.adminOrders);
  return {
    ok: true,
    event: toOrderEvent({
      id: row.id,
      action: "order.note",
      actor_email: row.actor_email ?? null,
      summary: row.summary ?? note,
      created_at: row.created_at,
    }),
  };
}

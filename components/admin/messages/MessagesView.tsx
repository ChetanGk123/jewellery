"use client";

import { useState, useTransition } from "react";
import { setMessageStatus } from "@/app/(admin)/admin/(console)/messages/actions";
import {
  type AdminMessageRow,
  type MessageCounts,
  type MessageFilter,
  type MessageStatus,
  MESSAGE_FILTERS,
  messageDateLabel,
  messageStatusChip,
} from "@/lib/admin/message";

type Props = {
  messages: AdminMessageRow[];
  counts: MessageCounts;
};

/**
 * Contact messages queue (TASKS 3.8, prototype-matched): All / New / In Progress
 * / Resolved filter pills with live counts over a responsive card grid. Each
 * ticket card shows its number, status pill, subject, sender, message and date,
 * with context actions — Start (New → In Progress), ✓ Resolve (→ Resolved) and
 * Reopen (Resolved → In Progress) — driven through the `setMessageStatus` server
 * action. Lands on New (the fresh-enquiry queue).
 */
export function MessagesView({ messages, counts }: Props) {
  const [filter, setFilter] = useState<MessageFilter>("New");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = messages.filter((m) =>
    filter === "All" ? true : m.status === filter,
  );

  const move = (row: AdminMessageRow, status: MessageStatus) => {
    setError(null);
    setPendingId(row.id);
    startTransition(async () => {
      const res = await setMessageStatus(row.id, status);
      setPendingId(null);
      if (!res.ok) setError(res.error ?? "Couldn't update the message.");
    });
  };

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {MESSAGE_FILTERS.map((tab) => {
          const active = filter === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              aria-pressed={active}
              className={`rounded-full border px-4 py-[9px] text-[12.5px] font-medium transition-colors ${
                active
                  ? "border-maroon-700 bg-maroon-700 text-cream-200"
                  : "border-[#EAE3D7] bg-white text-[#5E4A40] hover:border-[#D8CDB9]"
              }`}
            >
              {tab} <span className="opacity-70">{counts[tab]}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-lg border border-[#F0C8CE] bg-[#FBE9E7] px-3 py-2.5 font-body text-[12.5px] text-[#C0392F]">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-[#EAE3D7] bg-white px-[22px] py-[50px] text-center font-body text-[13px] text-[#A99C90]">
          No messages with this status.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((m) => {
            const chip = messageStatusChip(m.status);
            const isBusy = pendingId === m.id;
            return (
              <article
                key={m.id}
                className="flex flex-col gap-[11px] rounded-xl border border-[#EAE3D7] bg-white p-5"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <span className="font-body text-[12.5px] font-semibold tracking-[0.03em] text-[#71182B]">
                    {m.ticketNo}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-[11px] py-[5px] font-body text-[10.5px] font-semibold"
                    style={{ color: chip.color, background: chip.bg }}
                  >
                    {chip.label}
                  </span>
                </div>

                <div className="flex flex-col gap-[3px]">
                  <span className="font-heading text-[18px] font-semibold leading-[1.25] text-[#2A1F1A]">
                    {m.subject || "No subject"}
                  </span>
                  <span className="font-body text-[12px] text-[#A99C90]">
                    {m.name} · {m.contact}
                  </span>
                </div>

                <p className="m-0 whitespace-pre-line font-body text-[13px] font-light leading-[1.6] text-[#5E4A40]">
                  {m.body}
                </p>

                <div className="mt-0.5 flex items-center justify-between gap-2.5">
                  <span className="font-body text-[11.5px] text-[#A99C90]">
                    {messageDateLabel(m.createdAt)}
                  </span>
                  <div className="flex gap-2">
                    {m.status === "New" && (
                      <button
                        type="button"
                        onClick={() => move(m, "In Progress")}
                        disabled={isBusy}
                        className="rounded-md border border-[#E8D6A8] bg-[#FBF1DD] px-[13px] py-2 font-body text-[11.5px] font-semibold text-[#B7791F] transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        Start
                      </button>
                    )}
                    {m.status === "Resolved" && (
                      <button
                        type="button"
                        onClick={() => move(m, "In Progress")}
                        disabled={isBusy}
                        className="rounded-md border border-[#E7E0D4] bg-white px-[13px] py-2 font-body text-[11.5px] font-semibold text-[#5E4A40] transition-colors hover:bg-[#FBF8F2] disabled:opacity-60"
                      >
                        Reopen
                      </button>
                    )}
                    {m.status !== "Resolved" && (
                      <button
                        type="button"
                        onClick={() => move(m, "Resolved")}
                        disabled={isBusy}
                        className="rounded-md border border-[#BFE0C9] bg-[#E7F3EB] px-[13px] py-2 font-body text-[11.5px] font-semibold text-[#15692F] transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        ✓ Resolve
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

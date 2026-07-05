"use client";

import { useMemo, useState, useTransition } from "react";
import { removeSubscriber } from "@/app/(admin)/admin/(console)/subscribers/actions";
import {
  type AdminSubscriberRow,
  type SubscriberKpi,
  subscriberDateLabel,
  subscriberInitial,
  subscriberSourceChip,
} from "@/lib/admin/subscriber";

type Props = {
  subscribers: AdminSubscriberRow[];
  kpis: SubscriberKpi[];
};

/**
 * Subscribers console (TASKS 3.9, prototype-matched): three KPI cards over a
 * "Mailing list" card with an email search, Copy emails + Export CSV actions,
 * and a table (avatar · email · joined · source pill · × remove). Search
 * filters client-side; Copy/Export act on the currently-visible rows; remove
 * goes through the `removeSubscriber` server action.
 */
export function SubscribersView({ subscribers, kpis }: Props) {
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter((s) => s.email.toLowerCase().includes(q));
  }, [subscribers, search]);

  const remove = (row: AdminSubscriberRow) => {
    setError(null);
    setPendingId(row.id);
    startTransition(async () => {
      const res = await removeSubscriber(row.id);
      setPendingId(null);
      if (!res.ok) setError(res.error ?? "Couldn't remove the subscriber.");
    });
  };

  const copyEmails = async () => {
    const text = visible.map((s) => s.email).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn't copy to the clipboard.");
    }
  };

  const exportCsv = () => {
    const header = "email,source,joined\n";
    const body = visible
      .map((s) => `${csvCell(s.email)},${csvCell(s.source)},${csvCell(s.createdAt)}`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "subscribers.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-[18px]">
      {/* KPI cards */}
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="flex flex-col gap-2 rounded-xl border border-[#EAE3D7] bg-white p-5"
          >
            <span className="font-body text-[12px] font-medium leading-none text-[#8A7E74]">
              {k.label}
            </span>
            <span
              className="font-body text-[30px] font-semibold leading-none"
              style={{ color: k.accent }}
            >
              {k.value}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-[#F0C8CE] bg-[#FBE9E7] px-3 py-2.5 font-body text-[12.5px] text-[#C0392F]">
          {error}
        </p>
      )}

      {/* Mailing list */}
      <div className="overflow-hidden rounded-xl border border-[#EAE3D7] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#EFE9DE] px-[22px] py-4">
          <span className="font-body text-[15px] font-semibold text-[#2A1F1A]">
            Mailing list
          </span>
          <div className="ml-auto flex min-w-[170px] max-w-[300px] items-center rounded-lg border border-[#E7E0D4] bg-[#FBF8F2] px-3">
            <SearchIcon />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search email"
              aria-label="Search email"
              className="flex-1 border-none bg-transparent px-2 py-[9px] font-body text-[13px] text-[#2A1F1A] outline-none"
            />
          </div>
          <button
            type="button"
            onClick={copyEmails}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-[7px] rounded-lg border border-[#E7E0D4] bg-white px-[15px] py-2.5 font-body text-[12px] font-semibold text-[#5E4A40] transition-colors hover:border-[#C9A24B] hover:text-[#71182B] disabled:opacity-50"
          >
            <CopyIcon />
            {copied ? "Copied" : "Copy emails"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-[7px] rounded-lg border-none bg-[#71182B] px-[15px] py-2.5 font-body text-[12px] font-semibold text-[#F3E3C7] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <ExportIcon />
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="flex items-center gap-[14px] border-b border-[#EFE9DE] bg-[#FBF8F2] px-[22px] py-[13px] font-body text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A7E74]">
              <span className="flex-1">Subscriber</span>
              <span className="w-[140px]">Joined</span>
              <span className="w-[110px] text-center">Source</span>
              <span className="w-11" />
            </div>

            {visible.length === 0 ? (
              <div className="px-[22px] py-[50px] text-center font-body text-[13px] text-[#A99C90]">
                {subscribers.length === 0
                  ? "No subscribers yet."
                  : "No subscribers match your search."}
              </div>
            ) : (
              visible.map((s) => {
                const chip = subscriberSourceChip(s.source);
                const isBusy = pendingId === s.id;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-[14px] border-b border-[#F3EEE4] px-[22px] py-[13px]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full font-body text-[13px] font-semibold text-[#2A0A12]"
                        style={{
                          background:
                            "linear-gradient(135deg, #E6CA7E, #A87A1E)",
                        }}
                      >
                        {subscriberInitial(s.email)}
                      </span>
                      <span className="min-w-0 truncate font-body text-[13px] font-medium leading-[1.3] text-[#2A1F1A]">
                        {s.email}
                      </span>
                    </div>
                    <span className="w-[140px] font-body text-[12px] text-[#8A7E74]">
                      {subscriberDateLabel(s.createdAt)}
                    </span>
                    <span className="w-[110px] text-center">
                      <span
                        className="rounded-full px-2.5 py-[5px] font-body text-[10.5px] font-semibold"
                        style={{ color: chip.color, background: chip.bg }}
                      >
                        {chip.label}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(s)}
                      disabled={isBusy}
                      title="Remove subscriber"
                      aria-label={`Remove ${s.email}`}
                      className="flex w-11 items-center justify-center border-none bg-transparent text-[17px] leading-none text-[#C09A8E] transition-colors hover:text-[#C0392F] disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Escape a value for a CSV cell — quote and double any embedded quotes. */
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9C8A7E"
      strokeWidth={2}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
    >
      <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  exportSubscribers,
  removeSubscriber,
} from "@/app/(admin)/admin/(console)/subscribers/actions";
import { AdminPager } from "@/components/admin/ui/AdminPager";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import { csvCell } from "@/lib/utils/csv";
import {
  ADMIN_SUBSCRIBERS_PAGE_SIZE,
  type AdminSubscriberRow,
  subscriberDateLabel,
  subscriberInitial,
  subscriberSourceChip,
} from "@/lib/admin/subscriber";
import type { AdminSubscribersPage } from "@/lib/db/admin-subscribers";
import { ROUTES } from "@/lib/routes";

function hrefFor(search: string, page: number): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${ROUTES.adminSubscribers}?${qs}` : ROUTES.adminSubscribers;
}

/**
 * Subscribers console (TASKS 3.9, prototype-matched; paginated 5.10): three KPI
 * cards (computed from aggregate counts, so true for the whole list) over a
 * "Mailing list" card with a URL-driven email search (`?q`), Copy emails + Export
 * CSV, and a paginated table (avatar · email · joined · source pill · × remove).
 * Copy/Export pull the **entire** list on demand via `exportSubscribers` (not
 * just the current page); remove goes through the `removeSubscriber` action.
 */
export function SubscribersView({ page }: { page: AdminSubscribersPage }) {
  const router = useRouter();
  const [query, setQuery] = useState(page.search);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Removing is permanent — hold the row pending a confirm dialog rather than
  // deleting on the single × click (TASKS 5.4).
  const [confirming, setConfirming] = useState<AdminSubscriberRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitSearch = (raw: string) => {
    router.push(hrefFor(raw.trim(), 1));
  };

  const confirmRemove = () => {
    if (!confirming) return;
    const row = confirming;
    setError(null);
    setPendingId(row.id);
    startTransition(async () => {
      const res = await removeSubscriber(row.id);
      setPendingId(null);
      if (res.ok) {
        setConfirming(null);
      } else {
        setError(res.error ?? "Couldn't remove the subscriber.");
      }
    });
  };

  const copyEmails = async () => {
    setError(null);
    setIsExporting(true);
    try {
      const all = await exportSubscribers();
      await navigator.clipboard.writeText(all.map((s) => s.email).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Couldn't copy to the clipboard.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportCsv = async () => {
    setError(null);
    setIsExporting(true);
    try {
      const all = await exportSubscribers();
      const header = "email,source,joined\n";
      const body = all
        .map(
          (s) =>
            `${csvCell(s.email)},${csvCell(s.source)},${csvCell(s.createdAt)}`,
        )
        .join("\n");
      const blob = new Blob([header + body], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "subscribers.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't export the list.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-[18px]">
      {/* KPI cards */}
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {page.kpis.map((k) => (
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
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch(query);
            }}
            className="ml-auto flex min-w-[170px] max-w-[300px] items-center rounded-lg border border-[#E7E0D4] bg-[#FBF8F2] px-3"
          >
            <SearchIcon />
            <input
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search email"
              aria-label="Search email"
              className="flex-1 border-none bg-transparent px-2 py-[9px] font-body text-[13px] text-[#2A1F1A] outline-none"
            />
          </form>
          <button
            type="button"
            onClick={copyEmails}
            disabled={isExporting}
            className="inline-flex items-center gap-[7px] rounded-lg border border-[#E7E0D4] bg-white px-[15px] py-2.5 font-body text-[12px] font-semibold text-[#5E4A40] transition-colors hover:border-[#C9A24B] hover:text-[#71182B] disabled:opacity-50"
          >
            <CopyIcon />
            {copied ? "Copied" : "Copy emails"}
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={isExporting}
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

            {page.rows.length === 0 ? (
              <div className="px-[22px] py-[50px] text-center font-body text-[13px] text-[#A99C90]">
                {page.search
                  ? "No subscribers match your search."
                  : "No subscribers yet."}
              </div>
            ) : (
              page.rows.map((s) => {
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
                      onClick={() => {
                        setError(null);
                        setConfirming(s);
                      }}
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

      <AdminPager
        page={page.page}
        pageCount={page.pageCount}
        total={page.total}
        pageSize={ADMIN_SUBSCRIBERS_PAGE_SIZE}
        hrefForPage={(n) => hrefFor(page.search, n)}
      />

      {confirming && (
        <ConfirmDialog
          title="Remove subscriber?"
          body={
            <>
              <span className="font-semibold text-maroon-700">
                {confirming.email}
              </span>{" "}
              will be removed from the mailing list. They&rsquo;d need to
              re-subscribe to receive future updates.
            </>
          }
          confirmLabel="Remove"
          pendingLabel="Removing…"
          dismissLabel="Keep"
          isPending={isPending}
          error={error}
          onConfirm={confirmRemove}
          onClose={() => {
            if (!isPending) {
              setConfirming(null);
              setError(null);
            }
          }}
        />
      )}
    </div>
  );
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

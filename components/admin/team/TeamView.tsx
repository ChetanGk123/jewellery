"use client";

import { useState, useTransition } from "react";
import {
  grantAdmin,
  revokeAdmin,
} from "@/app/(admin)/admin/(console)/team/actions";
import {
  type AdminUser,
  type RoleAuditEntry,
  adminDateLabel,
  adminInitial,
  roleAuditSummary,
} from "@/lib/admin/team";
import { ConfirmRemoveDialog } from "./ConfirmRemoveDialog";

type Props = {
  admins: AdminUser[];
  audit: RoleAuditEntry[];
};

/**
 * Team manager (in-console admin management): grant access by email, see current
 * admins, revoke (with a confirm dialog), and a recent-changes audit trail.
 * Feedback is inline — no toast library — mirroring the `CouponModal` pattern
 * (`useTransition` + inline error/notice, buttons disabled while pending).
 */
export function TeamView({ admins, audit }: Props) {
  const [email, setEmail] = useState("");
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantNotice, setGrantNotice] = useState<string | null>(null);
  const [isGranting, startGrant] = useTransition();

  const [removing, setRemoving] = useState<AdminUser | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [isRevoking, startRevoke] = useTransition();

  const onGrant = () => {
    setGrantError(null);
    setGrantNotice(null);
    startGrant(async () => {
      const res = await grantAdmin(email);
      if (res.ok) {
        setEmail("");
        setGrantNotice(res.notice ?? "Access granted.");
      } else {
        setGrantError(res.error ?? "Couldn't grant access.");
      }
    });
  };

  const onConfirmRemove = () => {
    if (!removing) return;
    setRevokeError(null);
    startRevoke(async () => {
      const res = await revokeAdmin(removing.id);
      if (res.ok) setRemoving(null);
      else setRevokeError(res.error ?? "Couldn't remove access.");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Grant access */}
      <section className="rounded-xl border border-[#EAE3D7] bg-white p-[22px]">
        <h2 className="font-heading text-[19px] leading-none text-[#2A1F1A]">
          Grant admin access
        </h2>
        <p className="mt-2 font-body text-[13px] leading-relaxed text-[#8A7E74]">
          The person must already have a customer account. New admins must sign
          out and back in for access to take effect.
        </p>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isGranting) onGrant();
            }}
            placeholder="name@example.com"
            className="flex-1 rounded-lg border border-[#E7E0D4] bg-white px-3 py-[11px] font-body text-[14px] text-[#2A1F1A] outline-none focus:border-gold-400"
          />
          <button
            type="button"
            onClick={onGrant}
            disabled={isGranting}
            className="rounded-lg bg-maroon-700 px-6 py-[11px] font-body text-[12px] font-semibold text-cream-200 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isGranting ? "Granting…" : "Grant access"}
          </button>
        </div>

        {grantError && (
          <p className="mt-3 rounded-lg border border-[#F0C8CE] bg-[#FBE9E7] px-3 py-2.5 font-body text-[12.5px] leading-snug text-[#C0392F]">
            {grantError}
          </p>
        )}
        {grantNotice && (
          <p className="mt-3 rounded-lg border border-[#E7DCC2] bg-[#FBF1DD] px-3 py-2.5 font-body text-[12.5px] leading-snug text-[#7A5B12]">
            {grantNotice}
          </p>
        )}
      </section>

      {/* Current admins */}
      <section className="overflow-hidden rounded-xl border border-[#EAE3D7] bg-white">
        <div className="border-b border-[#EFE9DE] bg-[#FBF8F2] px-[22px] py-[13px] font-body text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A7E74]">
          Admins ({admins.length})
        </div>

        {admins.length === 0 ? (
          <p className="px-[22px] py-[50px] text-center font-body text-[13px] text-[#A99C90]">
            No admins found.
          </p>
        ) : (
          admins.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3.5 border-b border-[#F3EEE4] px-[22px] py-[15px] last:border-b-0"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3E3C7] font-body text-[13px] font-semibold text-maroon-700">
                {adminInitial(a.email)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-body text-[13.5px] font-medium text-[#2A1F1A]">
                  {a.email}
                  {a.isSelf && (
                    <span className="ml-2 rounded-full bg-[#EFE9DE] px-2 py-0.5 align-middle font-body text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#8A7E74]">
                      You
                    </span>
                  )}
                </span>
                <span className="font-body text-[12px] text-[#8A7E74]">
                  Admin since {adminDateLabel(a.grantedAt)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRevokeError(null);
                  setRemoving(a);
                }}
                disabled={a.isSelf}
                className="rounded-lg border border-[#DAD0C2] bg-white px-4 py-2 font-body text-[12px] font-semibold text-[#C0392F] transition-colors hover:bg-[#FBF8F2] disabled:cursor-not-allowed disabled:text-[#B9AEA2] disabled:opacity-70"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </section>

      {/* Recent changes */}
      <section className="overflow-hidden rounded-xl border border-[#EAE3D7] bg-white">
        <div className="border-b border-[#EFE9DE] bg-[#FBF8F2] px-[22px] py-[13px] font-body text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8A7E74]">
          Recent changes
        </div>
        {audit.length === 0 ? (
          <p className="px-[22px] py-[34px] text-center font-body text-[13px] text-[#A99C90]">
            No changes yet.
          </p>
        ) : (
          audit.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3.5 border-b border-[#F3EEE4] px-[22px] py-3 last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate font-body text-[12.5px] text-[#5E4A40]">
                <span
                  className={`mr-2 font-semibold ${
                    entry.action === "grant" ? "text-[#15692F]" : "text-[#C0392F]"
                  }`}
                >
                  {entry.action === "grant" ? "Granted" : "Removed"}
                </span>
                {roleAuditSummary(entry)}
              </span>
              <span className="shrink-0 font-body text-[12px] text-[#8A7E74]">
                {adminDateLabel(entry.createdAt)}
              </span>
            </div>
          ))
        )}
      </section>

      {removing && (
        <ConfirmRemoveDialog
          email={removing.email}
          isPending={isRevoking}
          error={revokeError}
          onConfirm={onConfirmRemove}
          onClose={() => {
            if (!isRevoking) setRemoving(null);
          }}
        />
      )}
    </div>
  );
}

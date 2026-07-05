"use client";

import { useState, useTransition } from "react";
import { updateStoreSettings } from "@/app/(admin)/admin/(console)/settings/actions";
import type { SettingsFormValues } from "@/lib/admin/settings";

type Props = { initial: SettingsFormValues };

const CARD = "rounded-xl border border-[#EAE3D7] bg-white p-6";
const LABEL = "font-body text-[12px] font-medium text-[#8A7E74]";
const INPUT =
  "mt-1.5 block w-full rounded-lg border border-[#E7E0D4] px-3 py-[11px] font-body text-[14px] text-[#2A1F1A] outline-none focus:border-[#C9A24B]";
const HEADING = "font-heading text-[20px] font-semibold text-[#2A1F1A]";

/**
 * Store Settings (TASKS 3.11, prototype-matched). Four cards over the single
 * `setting` row — Store Information, Shipping & Payments, Announcement Banner
 * (with live preview) and Homepage Promo Block (with live preview). One Save
 * persists everything through `updateStoreSettings`; the storefront reads
 * settings per request, so a save is live. Razorpay Live Mode is shown disabled
 * ("Coming soon") until the payments phase.
 */
export function SettingsView({ initial }: Props) {
  const [values, setValues] = useState<SettingsFormValues>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof SettingsFormValues>(
    key: K,
    value: SettingsFormValues[K],
  ) => {
    setSaved(false);
    setValues((prev) => ({ ...prev, [key]: value }));
  };
  const setBanner = (patch: Partial<SettingsFormValues["banner"]>) => {
    setSaved(false);
    setValues((prev) => ({ ...prev, banner: { ...prev.banner, ...patch } }));
  };
  const setPromo = (patch: Partial<SettingsFormValues["promo"]>) => {
    setSaved(false);
    setValues((prev) => ({ ...prev, promo: { ...prev.promo, ...patch } }));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateStoreSettings(values);
      if (res.ok) setSaved(true);
      else setError(res.error ?? "Couldn't save settings.");
    });
  };

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid items-start gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        {/* Store Information */}
        <div className={`${CARD} flex flex-col gap-4`}>
          <span className={HEADING}>Store Information</span>
          <label className={LABEL}>
            Store name
            <input
              className={INPUT}
              value={values.storeName}
              onChange={(e) => set("storeName", e.target.value)}
            />
          </label>
          <label className={LABEL}>
            Support email
            <input
              className={INPUT}
              type="email"
              value={values.supportEmail}
              onChange={(e) => set("supportEmail", e.target.value)}
            />
          </label>
          <div className="flex gap-3">
            <label className={`${LABEL} flex-1`}>
              Phone
              <input
                className={INPUT}
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </label>
            <label className={`${LABEL} flex-1`}>
              GSTIN
              <input
                className={INPUT}
                value={values.gstin}
                onChange={(e) => set("gstin", e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Shipping & Payments */}
        <div className={`${CARD} flex flex-col gap-4`}>
          <span className={HEADING}>Shipping &amp; Payments</span>
          <label className={LABEL}>
            Free shipping above (₹)
            <input
              className={INPUT}
              inputMode="numeric"
              value={String(values.freeShipThresholdRupees)}
              onChange={(e) =>
                set("freeShipThresholdRupees", toRupees(e.target.value))
              }
            />
          </label>
          <label className={LABEL}>
            Flat shipping rate (₹)
            <input
              className={INPUT}
              inputMode="numeric"
              value={String(values.flatRateRupees)}
              onChange={(e) => set("flatRateRupees", toRupees(e.target.value))}
            />
          </label>
          <ToggleRow
            title="Cash on Delivery"
            hint="Allow COD across India"
            checked={values.codEnabled}
            onChange={(v) => set("codEnabled", v)}
          />
          <ToggleRow
            title="Razorpay Live Mode"
            hint="Accept real payments — coming soon"
            checked={false}
            disabled
          />
        </div>

        {/* Announcement Banner */}
        <div className={`${CARD} col-span-full flex flex-col gap-4`}>
          <div className="flex items-center justify-between gap-3.5">
            <div className="flex flex-col gap-1">
              <span className={HEADING}>Announcement Banner</span>
              <span className="font-body text-[12px] leading-[1.4] text-[#A99C90]">
                Shown at the very top of your storefront. Changes apply live.
              </span>
            </div>
            <Toggle
              checked={values.banner.enabled}
              onChange={(v) => setBanner({ enabled: v })}
              label="Enable announcement banner"
            />
          </div>

          <Preview label="Live preview">
            <div className="flex flex-wrap items-center justify-center gap-x-1.5 bg-maroon-800 px-4 py-2 text-center font-body text-[12px] text-cream-200">
              {values.banner.msg1 && <span>{values.banner.msg1}</span>}
              {values.banner.msg2 && (
                <>
                  <Dot />
                  <span>{values.banner.msg2}</span>
                </>
              )}
              {values.banner.offerText && (
                <>
                  <Dot />
                  <span>
                    {values.banner.offerLabel}{" "}
                    <span className="font-semibold text-gold-300">
                      {values.banner.offerText}
                    </span>
                    {values.banner.code && (
                      <>
                        {" "}
                        with code{" "}
                        <span className="font-semibold text-gold-300">
                          {values.banner.code}
                        </span>
                      </>
                    )}
                  </span>
                </>
              )}
            </div>
          </Preview>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={LABEL}>
              Message 1
              <input
                className={INPUT}
                placeholder="Free shipping over ₹999"
                value={values.banner.msg1}
                onChange={(e) => setBanner({ msg1: e.target.value })}
              />
            </label>
            <label className={LABEL}>
              Message 2
              <input
                className={INPUT}
                placeholder="Cash on Delivery available"
                value={values.banner.msg2}
                onChange={(e) => setBanner({ msg2: e.target.value })}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={LABEL}>
              Offer label
              <input
                className={INPUT}
                placeholder="Festive offer:"
                value={values.banner.offerLabel}
                onChange={(e) => setBanner({ offerLabel: e.target.value })}
              />
            </label>
            <label className={LABEL}>
              Offer highlight
              <input
                className={INPUT}
                placeholder="FLAT 20% OFF"
                value={values.banner.offerText}
                onChange={(e) => setBanner({ offerText: e.target.value })}
              />
            </label>
            <label className={LABEL}>
              Promo code
              <input
                className={INPUT}
                placeholder="BRIDE20"
                value={values.banner.code}
                onChange={(e) => setBanner({ code: e.target.value })}
              />
            </label>
          </div>
          <span className="font-body text-[11.5px] leading-[1.5] text-[#A99C90]">
            Tip: leave a field empty to drop that part of the banner. The
            highlight and promo code appear in gold.
          </span>
        </div>

        {/* Homepage Promo Block */}
        <div className={`${CARD} col-span-full flex flex-col gap-4`}>
          <div className="flex items-center justify-between gap-3.5">
            <div className="flex flex-col gap-1">
              <span className={HEADING}>Homepage Promo Block</span>
              <span className="font-body text-[12px] leading-[1.4] text-[#A99C90]">
                The large festive offer block on your home page. Changes apply
                live.
              </span>
            </div>
            <Toggle
              checked={values.promo.enabled}
              onChange={(v) => setPromo({ enabled: v })}
              label="Enable homepage promo block"
            />
          </div>

          <Preview label="Live preview">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-maroon-800 px-6 py-5 text-cream-200">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="font-body text-[11px] uppercase tracking-[0.14em] text-gold-300">
                  {values.promo.eyebrow || "Eyebrow"}
                </span>
                <span className="font-heading text-[22px] leading-[1.15]">
                  {values.promo.title || "Headline"}
                </span>
                <span className="font-body text-[12.5px] text-[#D9C2B8]">
                  {values.promo.code && (
                    <>
                      Use code{" "}
                      <span className="font-semibold text-gold-300">
                        {values.promo.code}
                      </span>{" "}
                    </>
                  )}
                  {values.promo.note}
                </span>
              </div>
              <span className="shrink-0 rounded-sm bg-gold-300 px-4 py-2 font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-maroon-950">
                {values.promo.button || "Shop"}
              </span>
            </div>
          </Preview>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={LABEL}>
              Eyebrow
              <input
                className={INPUT}
                placeholder="Festive Season Offer"
                value={values.promo.eyebrow}
                onChange={(e) => setPromo({ eyebrow: e.target.value })}
              />
            </label>
            <label className={LABEL}>
              Headline
              <input
                className={INPUT}
                placeholder="Flat 20% off the bridal range"
                value={values.promo.title}
                onChange={(e) => setPromo({ title: e.target.value })}
              />
            </label>
            <label className={LABEL}>
              Button label
              <input
                className={INPUT}
                placeholder="Shop the Sale"
                value={values.promo.button}
                onChange={(e) => setPromo({ button: e.target.value })}
              />
            </label>
            <label className={LABEL}>
              Promo code
              <input
                className={INPUT}
                placeholder="BRIDE20"
                value={values.promo.code}
                onChange={(e) => setPromo({ code: e.target.value })}
              />
            </label>
            <label className={`${LABEL} sm:col-span-2`}>
              Note
              <input
                className={INPUT}
                placeholder="at checkout. Limited period."
                value={values.promo.note}
                onChange={(e) => setPromo({ note: e.target.value })}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-[#71182B] px-[22px] py-[11px] font-body text-[12px] font-semibold text-[#F3E3C7] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save Changes"}
        </button>
        {saved && (
          <span className="font-body text-[12.5px] font-medium text-[#15692F]">
            ✓ Saved — changes are live.
          </span>
        )}
        {error && (
          <span role="alert" className="font-body text-[12.5px] text-[#C0392F]">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

/** Parse a rupee text input to a non-negative integer (digits only). */
function toRupees(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits === "" ? 0 : Number.parseInt(digits, 10);
}

function Dot() {
  return <span className="text-gold-300/60">·</span>;
}

function Preview({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className="font-body text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#A99C90]">
        {label}
      </span>
      <div className="overflow-hidden rounded-lg border border-[#EFE9DE]">
        {children}
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#F0EADF] py-3">
      <div>
        <div className="font-body text-[13px] font-medium text-[#2A1F1A]">
          {title}
        </div>
        <div className="mt-1 font-body text-[11px] text-[#A99C90]">{hint}</div>
      </div>
      <Toggle
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        label={title}
      />
    </div>
  );
}

/** Pill switch matching the prototype (42×24, sliding knob). */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className="relative h-6 w-[42px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: checked ? "#71182B" : "#D8CDB9" }}
    >
      <span
        className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[left]"
        style={{ left: checked ? "21px" : "3px" }}
      />
    </button>
  );
}

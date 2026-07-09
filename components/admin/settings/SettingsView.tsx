"use client"

import { useState, useTransition } from "react"
import { updateStoreSettings } from "@/app/(admin)/admin/(console)/settings/actions"
import type { SettingsFormValues } from "@/lib/admin/settings"
import { STORE_INFO } from "@/lib/store-info"
import { SectionCard } from "./SectionCard"
import { StorageCard } from "./StorageCard"

type Props = { initial: SettingsFormValues }

const INPUT =
  "block w-full rounded-lg border border-[#E2D8C8] bg-white px-3.5 py-3 font-body text-[14px] text-[#2B2420] outline-none placeholder:text-[#B4A99A] focus:border-[#C9A24B]"
const LABEL_TEXT = "mb-[7px] block font-body text-[13px] font-semibold text-[#4A4038]"
const HINT = "font-normal text-[#B4A99A]"

/** Sidebar anchors — one per section card, dot-coded like the design. */
const NAV_SECTIONS = [
  { href: "#store-info", label: "Store Information", color: "#5B1A2E" },
  { href: "#brand-contact", label: "Brand & Contact", color: "#B4863A" },
  { href: "#shipping-payments", label: "Shipping & Payments", color: "#3E8552" },
  { href: "#announcement-banner", label: "Announcement Banner", color: "#5B1A2E" },
  { href: "#promo-block", label: "Homepage Promo Block", color: "#B4863A" },
  { href: "#storage", label: "Storage", color: "#3E8552" },
]

/**
 * Store Settings — implements the operator's "Settings page redesign"
 * (claude.ai/design `Settings Page.dc.html`): a sticky section-anchor sidebar
 * with a store-status card, five icon-headed section cards over the single
 * `setting` row, switch toggles, live banner/promo previews, and a sticky
 * save bar with a dirty indicator. Same data flow as before: one Save
 * persists everything through `updateStoreSettings`; the storefront reads
 * settings per request, so a save is live. Razorpay Live Mode stays a
 * disabled switch until the payments phase. Deviations from the design file:
 * its mock top bar is the real `AdminTopbar`, and its Playfair/Inter map to
 * the app's heading/body fonts (self-hosted; CSP blocks font CDNs).
 */
export function SettingsView({ initial }: Props) {
  const [values, setValues] = useState<SettingsFormValues>(initial)
  const [isDirty, setIsDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const touch = () => {
    setIsDirty(true)
    setSaved(false)
  }
  const set = <K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) => {
    touch()
    setValues((prev) => ({ ...prev, [key]: value }))
  }
  const setBanner = (patch: Partial<SettingsFormValues["banner"]>) => {
    touch()
    setValues((prev) => ({ ...prev, banner: { ...prev.banner, ...patch } }))
  }
  const setPromo = (patch: Partial<SettingsFormValues["promo"]>) => {
    touch()
    setValues((prev) => ({ ...prev, promo: { ...prev.promo, ...patch } }))
  }
  const setStoreInfo = (patch: Partial<SettingsFormValues["storeInfo"]>) => {
    touch()
    setValues((prev) => ({ ...prev, storeInfo: { ...prev.storeInfo, ...patch } }))
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateStoreSettings(values)
      if (res.ok) {
        setSaved(true)
        setIsDirty(false)
      } else {
        setError(res.error ?? "Couldn't save settings.")
      }
    })
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-8">
        {/* Section sidebar (design: 232px rail; hidden on narrow screens) */}
        <aside className="sticky top-6 hidden w-[232px] shrink-0 flex-col self-start border-r border-[#E6DECF] pb-6 pr-4 lg:flex">
          <span className="px-3 pb-3 font-body text-[11px] font-semibold tracking-[0.08em] text-[#A79C8C]">
            SECTIONS
          </span>
          <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
            {NAV_SECTIONS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-[11px] font-body text-[14px] font-medium text-[#3A332F] transition-colors hover:bg-[#E9E0D2]"
              >
                <span
                  aria-hidden="true"
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: item.color }}
                />
                {item.label}
              </a>
            ))}
          </nav>

          {/* Store status — honest derivation: COD is the only tender, so
              disabling it pauses checkout. */}
          <div className="mt-7 rounded-[10px] border border-[#E2D8C8] bg-white px-3 py-4">
            <div className="mb-1.5 font-body text-[12px] text-[#8B8177]">Store status</div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ background: values.codEnabled ? "#3E8552" : "#C99B3E" }}
              />
              <span className="font-body text-[13px] font-semibold text-[#2B2420]">
                {values.codEnabled ? "Live & accepting orders" : "COD off — checkout paused"}
              </span>
            </div>
          </div>
        </aside>

        {/* Section cards */}
        <div className="flex min-w-0 max-w-[1180px] flex-1 flex-col gap-6">
          <SectionCard
            id="store-info"
            iconBg="#F7E9E0"
            icon={<HomeIcon />}
            title="Store Information"
            subtitle="Core details used across invoices and admin"
          >
            <CardGrid>
              <Field label="Store name">
                <input
                  className={INPUT}
                  value={values.storeName}
                  onChange={(e) => set("storeName", e.target.value)}
                />
              </Field>
              <Field label="Support email">
                <input
                  className={INPUT}
                  type="email"
                  value={values.supportEmail}
                  onChange={(e) => set("supportEmail", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={INPUT}
                  value={values.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field label="GSTIN" hint="optional">
                <input
                  className={INPUT}
                  placeholder="e.g. 08ABCDE1234F1Z5"
                  value={values.gstin}
                  onChange={(e) => set("gstin", e.target.value)}
                />
              </Field>
            </CardGrid>
          </SectionCard>

          <SectionCard
            id="brand-contact"
            iconBg="#F1E7D2"
            icon={<StarIcon />}
            title="Brand & Contact"
            subtitle="Shown across the storefront. Leave a field blank to use the default (shown in grey)."
          >
            <CardGrid>
              <Field label="Descriptor">
                <input
                  className={INPUT}
                  value={values.storeInfo.descriptor}
                  placeholder={STORE_INFO.descriptor}
                  onChange={(e) => setStoreInfo({ descriptor: e.target.value })}
                />
              </Field>
              <Field label="WhatsApp number" hint="with country code">
                <input
                  className={INPUT}
                  inputMode="numeric"
                  value={values.storeInfo.whatsapp}
                  placeholder={STORE_INFO.whatsapp.number}
                  onChange={(e) => setStoreInfo({ whatsapp: e.target.value })}
                />
              </Field>
              <Field label="Tagline" full>
                <textarea
                  rows={2}
                  className={`${INPUT} resize-y`}
                  value={values.storeInfo.tagline}
                  placeholder={STORE_INFO.tagline}
                  onChange={(e) => setStoreInfo({ tagline: e.target.value })}
                />
              </Field>
              <Field label="Address line">
                <input
                  className={INPUT}
                  value={values.storeInfo.addressLine}
                  placeholder={STORE_INFO.address.line}
                  onChange={(e) => setStoreInfo({ addressLine: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-x-6">
                <Field label="City">
                  <input
                    className={INPUT}
                    value={values.storeInfo.addressCity}
                    placeholder={STORE_INFO.address.city}
                    onChange={(e) => setStoreInfo({ addressCity: e.target.value })}
                  />
                </Field>
                <Field label="State">
                  <input
                    className={INPUT}
                    value={values.storeInfo.addressState}
                    placeholder={STORE_INFO.address.state}
                    onChange={(e) => setStoreInfo({ addressState: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Visiting note">
                <input
                  className={INPUT}
                  value={values.storeInfo.addressNote}
                  placeholder={STORE_INFO.address.note}
                  onChange={(e) => setStoreInfo({ addressNote: e.target.value })}
                />
              </Field>
              <Field label="Opening hours" hint="short">
                <input
                  className={INPUT}
                  value={values.storeInfo.hoursShort}
                  placeholder={STORE_INFO.hours.short}
                  onChange={(e) => setStoreInfo({ hoursShort: e.target.value })}
                />
              </Field>
              <Field label="Opening hours" hint="full">
                <input
                  className={INPUT}
                  value={values.storeInfo.hoursLong}
                  placeholder={STORE_INFO.hours.long}
                  onChange={(e) => setStoreInfo({ hoursLong: e.target.value })}
                />
              </Field>
              <Field label="Hours note" full>
                <input
                  className={INPUT}
                  value={values.storeInfo.hoursNote}
                  placeholder={STORE_INFO.hours.note}
                  onChange={(e) => setStoreInfo({ hoursNote: e.target.value })}
                />
              </Field>
            </CardGrid>
          </SectionCard>

          <SectionCard
            id="shipping-payments"
            iconBg="#E7EEE7"
            icon={<TruckIcon />}
            title="Shipping & Payments"
            subtitle="Checkout rules and payment methods"
          >
            <div className="grid gap-x-6 gap-y-5 px-[30px] pb-3 pt-[26px] max-sm:px-5 sm:grid-cols-2">
              <Field label="Free shipping above (₹)">
                <input
                  className={INPUT}
                  inputMode="numeric"
                  value={String(values.freeShipThresholdRupees)}
                  onChange={(e) => set("freeShipThresholdRupees", toRupees(e.target.value))}
                />
              </Field>
              <Field label="Flat shipping rate (₹)">
                <input
                  className={INPUT}
                  inputMode="numeric"
                  value={String(values.flatRateRupees)}
                  onChange={(e) => set("flatRateRupees", toRupees(e.target.value))}
                />
              </Field>
            </div>
            <div className="flex flex-col gap-3 px-[30px] pb-[26px] pt-3 max-sm:px-5">
              <PaymentRow
                iconBg="#F7E9E0"
                icon={<CardIcon />}
                title="Cash on Delivery"
                hint="Allow COD across India"
                checked={values.codEnabled}
                onChange={(v) => set("codEnabled", v)}
              />
              <PaymentRow
                iconBg="#EDEAE3"
                icon={<CheckCircleIcon />}
                title="Razorpay Live Mode"
                hint="Accept real payments — coming soon"
                checked={false}
                disabled
              />
            </div>
          </SectionCard>

          <SectionCard
            id="announcement-banner"
            iconBg="#F7E9E0"
            icon={<MegaphoneIcon />}
            title="Announcement Banner"
            subtitle="Shown at the very top of your storefront. Changes apply live."
            headerRight={
              <Switch
                checked={values.banner.enabled}
                onChange={(v) => setBanner({ enabled: v })}
                label="Enable announcement banner"
              />
            }
          >
            <div className="px-[30px] pt-[22px] max-sm:px-5">
              <PreviewLabel />
              <div
                className="rounded-lg bg-[#4B1122] px-5 py-[13px] text-center font-body text-[13.5px] leading-relaxed text-[#EFE3DA]"
                style={{ opacity: values.banner.enabled ? 1 : 0.45 }}
              >
                {values.banner.msg1 && <span>{values.banner.msg1}</span>}
                {values.banner.msg2 && (
                  <>
                    <Sep />
                    <span>{values.banner.msg2}</span>
                  </>
                )}
                {values.banner.offerText && (
                  <>
                    <Sep />
                    <span>
                      {values.banner.offerLabel}{" "}
                      <span className="font-bold text-[#E3B15E]">{values.banner.offerText}</span>
                      {values.banner.code && (
                        <>
                          {" "}
                          with code{" "}
                          <span className="font-bold text-[#E3B15E]">{values.banner.code}</span>
                        </>
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
            <CardGrid>
              <Field label="Message 1">
                <input
                  className={INPUT}
                  placeholder="Free shipping over ₹999"
                  value={values.banner.msg1}
                  onChange={(e) => setBanner({ msg1: e.target.value })}
                />
              </Field>
              <Field label="Message 2">
                <input
                  className={INPUT}
                  placeholder="Cash on Delivery available"
                  value={values.banner.msg2}
                  onChange={(e) => setBanner({ msg2: e.target.value })}
                />
              </Field>
              <Field label="Offer label">
                <input
                  className={INPUT}
                  placeholder="Festive offer:"
                  value={values.banner.offerLabel}
                  onChange={(e) => setBanner({ offerLabel: e.target.value })}
                />
              </Field>
              <Field label="Offer highlight">
                <input
                  className={INPUT}
                  placeholder="FLAT 20% OFF"
                  value={values.banner.offerText}
                  onChange={(e) => setBanner({ offerText: e.target.value })}
                />
              </Field>
              <Field label="Promo code">
                <input
                  className={INPUT}
                  placeholder="BRIDE20"
                  value={values.banner.code}
                  onChange={(e) => setBanner({ code: e.target.value })}
                />
              </Field>
            </CardGrid>
            <div className="mx-[30px] mb-6 rounded-lg border border-[#EFE9DE] bg-[#FBF8F3] px-4 py-3 font-body text-[12.5px] text-[#8B8177] max-sm:mx-5">
              Tip: leave a field empty to drop that part of the banner. The highlight and promo code
              appear in gold.
            </div>
          </SectionCard>

          <SectionCard
            id="promo-block"
            iconBg="#F1E7D2"
            icon={<PanelIcon />}
            title="Homepage Promo Block"
            subtitle="The large festive offer block on your home page. Changes apply live."
            headerRight={
              <Switch
                checked={values.promo.enabled}
                onChange={(v) => setPromo({ enabled: v })}
                label="Enable homepage promo block"
              />
            }
          >
            <div className="px-[30px] pt-[22px] max-sm:px-5">
              <PreviewLabel />
              <div
                className="flex flex-wrap items-center justify-between gap-5 rounded-[10px] bg-[linear-gradient(135deg,#4B1122,#5B1A2E)] px-[30px] py-[26px] max-sm:px-5"
                style={{ opacity: values.promo.enabled ? 1 : 0.45 }}
              >
                <div className="min-w-0">
                  <div className="mb-2 font-body text-[11px] font-bold uppercase tracking-[0.1em] text-[#E3B15E]">
                    {values.promo.eyebrow || "Eyebrow"}
                  </div>
                  <div className="mb-2 font-heading text-[26px] font-semibold leading-tight text-white">
                    {values.promo.title || "Headline"}
                  </div>
                  <div className="font-body text-[13.5px] text-[#D9C7BC]">
                    {values.promo.code && (
                      <>
                        Use code{" "}
                        <span className="font-bold text-[#E3B15E]">{values.promo.code}</span>{" "}
                      </>
                    )}
                    {values.promo.note}
                  </div>
                </div>
                <div className="shrink-0 whitespace-nowrap rounded-[7px] bg-[#E3B15E] px-[26px] py-[13px] font-body text-[13px] font-bold uppercase tracking-[0.03em] text-[#3A2712]">
                  {values.promo.button || "Shop"}
                </div>
              </div>
            </div>
            <CardGrid>
              <Field label="Eyebrow">
                <input
                  className={INPUT}
                  placeholder="Festive Season Offer"
                  value={values.promo.eyebrow}
                  onChange={(e) => setPromo({ eyebrow: e.target.value })}
                />
              </Field>
              <Field label="Headline">
                <input
                  className={INPUT}
                  placeholder="Flat 20% off the entire bridal range"
                  value={values.promo.title}
                  onChange={(e) => setPromo({ title: e.target.value })}
                />
              </Field>
              <Field label="Button label">
                <input
                  className={INPUT}
                  placeholder="Shop the Sale"
                  value={values.promo.button}
                  onChange={(e) => setPromo({ button: e.target.value })}
                />
              </Field>
              <Field label="Promo code">
                <input
                  className={INPUT}
                  placeholder="BRIDE20"
                  value={values.promo.code}
                  onChange={(e) => setPromo({ code: e.target.value })}
                />
              </Field>
              <Field label="Note" full>
                <input
                  className={INPUT}
                  placeholder="at checkout. Limited period."
                  value={values.promo.note}
                  onChange={(e) => setPromo({ note: e.target.value })}
                />
              </Field>
            </CardGrid>
          </SectionCard>

          <StorageCard />
        </div>
      </div>

      {/* Sticky save bar (floats inset rather than full-bleed — robust to the
          console shell's padding). */}
      <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2D8C8] bg-white px-6 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.04),0_8px_24px_rgba(42,10,18,0.08)]">
        {error ? (
          <span role="alert" className="font-body text-[13px] font-medium text-[#C0392F]">
            {error}
          </span>
        ) : (
          <span className="flex items-center gap-2 font-body text-[13px] text-[#8B8177]">
            <span
              aria-hidden="true"
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: isDirty ? "#C99B3E" : saved ? "#3E8552" : "#DDD4C6" }}
            />
            {isDirty
              ? "You have unsaved changes"
              : saved
                ? "Saved — changes are live"
                : "No unsaved changes"}
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-[#5B1A2E] px-7 py-[13px] font-body text-[14px] font-semibold tracking-[0.01em] text-[#F7EDE3] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  )
}

/** Parse a rupee text input to a non-negative integer (digits only). */
function toRupees(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "")
  return digits === "" ? 0 : Number.parseInt(digits, 10)
}

/* ------------------------------ Building blocks --------------------------- */
/* SectionCard lives in ./SectionCard.tsx (shared with StorageCard). */

/** The standard two-column field grid used by every card body. */
function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-5 px-[30px] pb-[30px] pt-[26px] max-sm:px-5 sm:grid-cols-2">
      {children}
    </div>
  )
}

function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string
  hint?: string
  full?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={full ? "sm:col-span-2" : undefined}>
      <span className={LABEL_TEXT}>
        {label} {hint && <span className={HINT}>({hint})</span>}
      </span>
      {children}
    </label>
  )
}

function PreviewLabel() {
  return (
    <div className="mb-2.5 font-body text-[11px] font-semibold tracking-[0.06em] text-[#A79C8C]">
      LIVE PREVIEW
    </div>
  )
}

function Sep() {
  return <span className="mx-1.5 opacity-70">·</span>
}

/** A payment-method row: icon tile, title + hint, switch (design's toggle rows). */
function PaymentRow({
  icon,
  iconBg,
  title,
  hint,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  hint: string
  checked: boolean
  onChange?: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[10px] border border-[#EFE9DE] bg-[#FBF8F3] px-[18px] py-4">
      <div className="flex min-w-0 items-center gap-3.5">
        <div
          aria-hidden="true"
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-body text-[14px] font-semibold text-[#2B2420]">{title}</div>
          <div className="mt-0.5 font-body text-[12.5px] text-[#8B8177]">{hint}</div>
        </div>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </div>
  )
}

/** iOS-style switch per the design (44×26, sliding 20px knob). */
function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange?: (value: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className="relative h-[26px] w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: checked ? "#5B1A2E" : "#DDD4C6" }}
    >
      <span
        className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[left]"
        style={{ left: checked ? "21px" : "3px" }}
      />
    </button>
  )
}

/* ------------------------------- Card icons ------------------------------- */
/* Inline strokes copied from the design file. */

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 9.5L12 3l9 6.5"
        stroke="#5B1A2E"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 10v10h14V10" stroke="#5B1A2E" strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2l2.6 6.6L21 10l-5.4 4.3L17 21l-5-3.6L7 21l1.4-6.7L3 10l6.4-1.4z"
        stroke="#B4863A"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="7" width="14" height="10" rx="1.5" stroke="#3E8552" strokeWidth={1.7} />
      <path d="M16 10h3l3 3.5V17h-6" stroke="#3E8552" strokeWidth={1.7} strokeLinejoin="round" />
      <circle cx="7" cy="19" r="1.6" stroke="#3E8552" strokeWidth={1.5} />
      <circle cx="17.5" cy="19" r="1.6" stroke="#3E8552" strokeWidth={1.5} />
    </svg>
  )
}

function MegaphoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 11v2a2 2 0 002 2h1l2 5h2l-1.5-5H15l5 3V6l-5 3H6a2 2 0 00-2 2z"
        stroke="#5B1A2E"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PanelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="#B4863A" strokeWidth={1.6} />
      <path d="M3 9h18" stroke="#B4863A" strokeWidth={1.6} />
    </svg>
  )
}

function CardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="20" height="14" rx="2" stroke="#5B1A2E" strokeWidth={1.7} />
      <path d="M2 10h20" stroke="#5B1A2E" strokeWidth={1.7} />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#8B8177" strokeWidth={1.7} />
      <path
        d="M9 12l2 2 4-4"
        stroke="#8B8177"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

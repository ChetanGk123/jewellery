"use client"

import { useMemo, useState, useTransition } from "react"
import { sendTestEmail, updateEmailCopy } from "@/app/(admin)/admin/(console)/emails/actions"
import { SectionCard } from "@/components/admin/settings/SectionCard"
import type { EmailCopyFormValues } from "@/lib/admin/email-copy"
import {
  COPY_TOKENS,
  EMAIL_COPY_DEFAULTS,
  type EmailTemplateId,
  resolveEmailCopy,
} from "@/lib/email/copy"
import { buildSampleEmail } from "@/lib/email/samples"
import type { ResolvedStoreInfo } from "@/lib/store-info"
import { EmailPreview } from "./EmailPreview"

type Props = {
  initial: EmailCopyFormValues
  /** Resolved store identity — the previews render with the real brand. */
  storeInfo: ResolvedStoreInfo
  /** Absolute site origin for preview links (SITE_URL). */
  baseUrl: string
  /** False when RESEND_API_KEY is missing — test sends are disabled. */
  isEmailConfigured: boolean
  /** Where test sends go (the admin alert inbox). */
  testRecipient: string
}

const INPUT =
  "block w-full rounded-lg border border-[#E2D8C8] bg-white px-3.5 py-3 font-body text-[14px] text-[#2B2420] outline-none placeholder:text-[#B4A99A] focus:border-[#C9A24B]"
const LABEL_TEXT = "mb-[7px] block font-body text-[13px] font-semibold text-[#4A4038]"

type FieldDef = { key: string; label: string; multiline?: boolean }

const SUBJECT: FieldDef = { key: "subject", label: "Subject line" }
const HEADING: FieldDef = { key: "heading", label: "Heading" }
const BUTTON: FieldDef = { key: "button", label: "Button label" }
const STATUS_FIELDS: FieldDef[] = [
  SUBJECT,
  HEADING,
  { key: "intro", label: "Intro paragraph", multiline: true },
  { key: "totalLabel", label: "Total label" },
  { key: "note", label: "Note box", multiline: true },
  BUTTON,
]

type TemplateDef = {
  id: EmailTemplateId
  label: string
  description: string
  fields: FieldDef[]
}

/** Rail order: the customer journey first, then the operator's own mail. */
const TEMPLATE_GROUPS: Array<{ group: string; templates: TemplateDef[] }> = [
  {
    group: "Customer",
    templates: [
      {
        id: "orderConfirmation",
        label: "Order confirmed",
        description: "Sent the moment a COD order is placed",
        fields: [
          SUBJECT,
          HEADING,
          { key: "intro", label: "Intro paragraph", multiline: true },
          { key: "codNotice", label: "COD notice box", multiline: true },
          BUTTON,
        ],
      },
      {
        id: "orderShipped",
        label: "Order shipped",
        description: "Sent when you mark an order Shipped",
        fields: STATUS_FIELDS,
      },
      {
        id: "orderDelivered",
        label: "Order delivered",
        description: "Sent on delivery, with review invitations",
        fields: STATUS_FIELDS,
      },
      {
        id: "orderCancelled",
        label: "Order cancelled",
        description: "Sent when an order is cancelled",
        fields: STATUS_FIELDS,
      },
      {
        id: "abandonedCart",
        label: "Abandoned cart",
        description: "Reminder after a cart sits idle for 24h",
        fields: [
          SUBJECT,
          HEADING,
          { key: "intro", label: "Intro paragraph", multiline: true },
          { key: "notice", label: "Notice box", multiline: true },
          BUTTON,
        ],
      },
      {
        id: "subscriberWelcome",
        label: "Subscriber welcome",
        description: "One-time welcome for new newsletter sign-ups",
        fields: [SUBJECT, HEADING, { key: "body", label: "Body paragraph", multiline: true }, BUTTON],
      },
    ],
  },
  {
    group: "Internal",
    templates: [
      {
        id: "adminAlert",
        label: "New-order alert",
        description: "Pushed to your inbox when an order lands",
        fields: [SUBJECT, HEADING, BUTTON],
      },
      {
        id: "dailyDigest",
        label: "Daily digest",
        description: "Close-of-day numbers from the scheduler",
        fields: [SUBJECT, HEADING, BUTTON],
      },
    ],
  },
]

const ALL_TEMPLATES = TEMPLATE_GROUPS.flatMap((g) => g.templates)

type TestState = { kind: "idle" | "ok" | "error"; message?: string }

/**
 * Emails console (TASKS 7.5): pick a template on the left, edit its wording,
 * watch the preview re-render as you type. Blank fields fall back to the
 * built-in wording (shown as placeholders); one Save persists every template
 * through `updateEmailCopy`. The preview is built client-side from the CURRENT
 * form state — the builders are pure — while "Send test email" uses the SAVED
 * copy, so it prompts you to save first when there are edits.
 */
export function EmailsView({ initial, storeInfo, baseUrl, isEmailConfigured, testRecipient }: Props) {
  const [values, setValues] = useState<EmailCopyFormValues>(initial)
  const [selectedId, setSelectedId] = useState<EmailTemplateId>("orderConfirmation")
  const [isDirty, setIsDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [testState, setTestState] = useState<TestState>({ kind: "idle" })
  const [isTesting, startTest] = useTransition()

  const selected = ALL_TEMPLATES.find((t) => t.id === selectedId) ?? ALL_TEMPLATES[0]

  // The form values ARE the override blob shape ("" = unset), so the same
  // resolve the send path uses turns them into complete preview copy.
  const previewMessage = useMemo(
    () => buildSampleEmail(selected.id, { info: storeInfo, copy: resolveEmailCopy(values), baseUrl }),
    [selected.id, values, storeInfo, baseUrl],
  )

  const groupOf = (id: EmailTemplateId) => values[id] as Record<string, string>
  const defaultsOf = (id: EmailTemplateId) => EMAIL_COPY_DEFAULTS[id] as Record<string, string>
  const tokensOf = (id: EmailTemplateId, key: string) =>
    (COPY_TOKENS[id] as Partial<Record<string, string[]>>)[key]

  const touch = () => {
    setIsDirty(true)
    setSaved(false)
  }

  const setField = (key: string, value: string) => {
    touch()
    setValues((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], [key]: value } }))
  }

  const resetTemplate = () => {
    touch()
    const blank = Object.fromEntries(selected.fields.map((f) => [f.key, ""]))
    setValues((prev) => ({ ...prev, [selected.id]: blank as (typeof prev)[EmailTemplateId] }))
  }

  const selectTemplate = (id: EmailTemplateId) => {
    setSelectedId(id)
    setTestState({ kind: "idle" })
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      const res = await updateEmailCopy(values)
      if (res.ok) {
        setSaved(true)
        setIsDirty(false)
      } else {
        setError(res.error ?? "Couldn't save the email copy.")
      }
    })
  }

  const runTestSend = () => {
    setTestState({ kind: "idle" })
    startTest(async () => {
      const res = await sendTestEmail(selected.id)
      setTestState(
        res.ok
          ? { kind: "ok", message: `Test sent to ${res.recipient}` }
          : { kind: "error", message: res.error ?? "Couldn't send the test email." },
      )
    })
  }

  const hasOverrides = selected.fields.some((f) => groupOf(selected.id)[f.key] !== "")

  const railItem = (t: TemplateDef) => (
    <button
      key={t.id}
      type="button"
      onClick={() => selectTemplate(t.id)}
      aria-current={t.id === selected.id ? "true" : undefined}
      className={`flex w-full items-center gap-3 whitespace-nowrap rounded-lg px-3 py-[11px] text-left font-body text-[14px] font-medium transition-colors lg:whitespace-normal ${
        t.id === selected.id ? "bg-[#E9E0D2] text-[#241412]" : "text-[#3A332F] hover:bg-[#E9E0D2]"
      }`}
    >
      <span
        aria-hidden="true"
        className="h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: t.id === selected.id ? "#B4863A" : "#DDD4C6" }}
      />
      {t.label}
    </button>
  )

  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-8">
        {/* Template rail (Settings-sidebar pattern; chips on narrow screens). */}
        <aside className="sticky top-6 hidden w-[232px] shrink-0 flex-col self-start border-r border-[#E6DECF] pb-6 pr-4 lg:flex">
          {TEMPLATE_GROUPS.map(({ group, templates }) => (
            <div key={group} className="flex flex-col">
              <span className="px-3 pb-2 pt-3 font-body text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A79C8C]">
                {group}
              </span>
              <nav aria-label={`${group} emails`} className="flex flex-col gap-0.5">
                {templates.map(railItem)}
              </nav>
            </div>
          ))}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Narrow screens: the rail as scrollable chips. */}
          <nav aria-label="Email templates" className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {ALL_TEMPLATES.map(railItem)}
          </nav>

          <SectionCard
            id={`email-${selected.id}`}
            icon={<MailIcon />}
            iconBg="#F3E7E0"
            title={selected.label}
            subtitle={selected.description}
            headerRight={
              hasOverrides ? (
                <button
                  type="button"
                  onClick={resetTemplate}
                  className="shrink-0 rounded-lg border border-[#E2D8C8] bg-white px-4 py-2 font-body text-[13px] font-medium text-[#4A4038] transition-colors hover:bg-[#F5F1EA]"
                >
                  Reset to defaults
                </button>
              ) : undefined
            }
          >
            <div className="grid gap-8 px-[30px] pb-[30px] pt-[26px] max-sm:px-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              {/* Editor column */}
              <div className="flex min-w-0 flex-col gap-5">
                {selected.fields.map((field) => {
                  const value = groupOf(selected.id)[field.key] ?? ""
                  const placeholder = defaultsOf(selected.id)[field.key]
                  const tokens = tokensOf(selected.id, field.key)
                  const inputId = `${selected.id}-${field.key}`
                  return (
                    <div key={field.key}>
                      <label htmlFor={inputId} className={LABEL_TEXT}>
                        {field.label}
                      </label>
                      {field.multiline ? (
                        <textarea
                          id={inputId}
                          rows={3}
                          value={value}
                          onChange={(e) => setField(field.key, e.target.value)}
                          placeholder={placeholder}
                          className={`${INPUT} resize-y`}
                        />
                      ) : (
                        <input
                          id={inputId}
                          type="text"
                          value={value}
                          onChange={(e) => setField(field.key, e.target.value)}
                          placeholder={placeholder}
                          className={INPUT}
                        />
                      )}
                      <p className="mt-1.5 font-body text-[12px] text-[#B4A99A]">
                        {tokens?.length
                          ? `Tokens: ${tokens.map((t) => `{${t}}`).join(", ")} · blank = default`
                          : "Blank = the built-in wording"}
                      </p>
                    </div>
                  )
                })}

                {/* Test send — saved copy only, so nudge when dirty. */}
                <div className="mt-1 rounded-[10px] border border-[#E2D8C8] bg-[#FDFBF7] px-4 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={runTestSend}
                      disabled={!isEmailConfigured || isTesting}
                      className="rounded-lg border border-[#5B1A2E] bg-white px-4 py-2 font-body text-[13px] font-semibold text-[#5B1A2E] transition-colors hover:bg-[#F7EDE3] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isTesting ? "Sending…" : "Send test email"}
                    </button>
                    <span className="font-body text-[12px] text-[#8B8177]">
                      {isEmailConfigured
                        ? `Delivers this template with sample data to ${testRecipient}`
                        : "Email isn't configured — set RESEND_API_KEY to enable test sends."}
                    </span>
                  </div>
                  {isDirty && isEmailConfigured && (
                    <p className="mt-2 font-body text-[12px] text-[#B4863A]">
                      Test sends use the last saved wording — save your changes first to test them.
                    </p>
                  )}
                  {testState.kind === "ok" && (
                    <p role="status" className="mt-2 font-body text-[13px] font-medium text-[#3E8552]">
                      {testState.message}
                    </p>
                  )}
                  {testState.kind === "error" && (
                    <p role="alert" className="mt-2 font-body text-[13px] font-medium text-[#C0392F]">
                      {testState.message}
                    </p>
                  )}
                </div>
              </div>

              <EmailPreview message={previewMessage} />
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Sticky save bar — the SettingsView pattern, one Save for all templates. */}
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
                ? "Saved — new orders will use this wording"
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

function MailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#5B1A2E"
      strokeWidth={1.7}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.4 6.5 8.6 6 8.6-6" />
    </svg>
  )
}

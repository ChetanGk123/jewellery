import { afterEach, beforeEach, expect, mock, test } from "bun:test"
import { DEFAULT_EMAIL_COPY } from "./copy"
import { DEFAULT_STORE_INFO } from "@/lib/store-info"

/**
 * Unit tests for the SMTP transport (TASKS 10.4) — the layer 4.6 never covered,
 * which is how a total send failure went unnoticed in production for weeks.
 * Nodemailer is mocked so nothing opens a socket; we drive `sendMail`'s outcome
 * to exercise every branch. Focus areas:
 *   - an incomplete SMTP config disables sending WITHOUT attempting a connection,
 *   - a rejected send is reported as false, never thrown (checkout must survive it),
 *   - the `From` falls back to SMTP_USER, since providers reject a From they
 *     don't own — the exact bug that made the Resend setup undeliverable,
 *   - the transport is pooled: built once and reused across sends.
 */

// Params are declared (and `_`-prefixed, as the other test mocks do) so
// `mock.calls` stays typed as a tuple and assertions can index into it.
const sendMail = mock(async (_options: unknown) => ({ messageId: "test" }))

/**
 * Every transport config ever built, in order. Kept separate from
 * `createTransport.mock.calls` because `beforeEach` clears those, and the
 * transport is module-level state built exactly once — so a per-test assertion
 * on the mock would silently assert nothing after the first send.
 */
const transportConfigs: Array<Record<string, unknown>> = []
const createTransport = mock((config: unknown) => {
  transportConfigs.push(config as Record<string, unknown>)
  return { sendMail }
})

mock.module("nodemailer", () => ({
  default: { createTransport },
  createTransport,
}))

// The templates are covered by their own builder tests; here they'd only add a
// live DB dependency, so the saved copy and store identity are stubbed.
mock.module("@/lib/db/settings", () => ({
  getStoreInfo: async () => DEFAULT_STORE_INFO,
  getEmailCopy: async () => DEFAULT_EMAIL_COPY,
}))

const { isEmailEnabled, sendTestTemplateEmailNow } = await import("./send")

const SMTP_ENV = {
  SMTP_HOST: "smtp.example.com",
  SMTP_USER: "store@example.com",
  SMTP_PASS: "app-password",
} as const

const ENV_KEYS = [...Object.keys(SMTP_ENV), "SMTP_PORT", "EMAIL_FROM", "ADMIN_ALERT_EMAIL"] as const

/** Snapshot of the real env, restored after each test. */
const original = new Map<string, string | undefined>()

beforeEach(() => {
  for (const key of ENV_KEYS) original.set(key, process.env[key])
  Object.assign(process.env, SMTP_ENV)
  // Blank, not absent — this is exactly what `${SMTP_PORT:-}` in
  // docker-compose.yml delivers, and it must still resolve to the 587 default.
  // Set from the very first test so the one pooled transport is built with it.
  process.env.SMTP_PORT = ""
  delete process.env.EMAIL_FROM
  sendMail.mockClear()
  createTransport.mockClear()
})

afterEach(() => {
  for (const [key, value] of original) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  original.clear()
})

/** The single option object handed to `transport.sendMail`. */
function lastSendMailOptions(): Record<string, unknown> {
  return sendMail.mock.calls.at(-1)?.[0] as Record<string, unknown>
}

test("isEmailEnabled is true only when host, user and password are all set", () => {
  expect(isEmailEnabled()).toBe(true)

  for (const key of Object.keys(SMTP_ENV)) {
    const saved = process.env[key]
    delete process.env[key]
    expect(isEmailEnabled()).toBe(false)
    process.env[key] = saved
  }
})

test("does not attempt a connection when SMTP is unconfigured", async () => {
  delete process.env.SMTP_HOST

  const result = await sendTestTemplateEmailNow("orderConfirmation")

  expect(result.sent).toBe(false)
  expect(sendMail).not.toHaveBeenCalled()
})

test("reports a delivered message as sent, with both html and text bodies", async () => {
  const result = await sendTestTemplateEmailNow("orderConfirmation")

  expect(result.sent).toBe(true)
  const options = lastSendMailOptions()
  expect(options.to).toBe(result.to)
  expect(options.subject).toContain("[Test]")
  expect(options.html).toBeTruthy()
  expect(options.text).toBeTruthy()
})

test("returns false instead of throwing when the provider rejects the send", async () => {
  sendMail.mockImplementationOnce(async () => {
    throw new Error("535 Authentication failed")
  })

  // Must not reject: a mail failure can never fail an already-placed order.
  const result = await sendTestTemplateEmailNow("orderConfirmation")

  expect(result.sent).toBe(false)
})

test("sends From the SMTP account when EMAIL_FROM is unset", async () => {
  await sendTestTemplateEmailNow("orderConfirmation")

  // Providers reject or rewrite a From the authenticated account doesn't own,
  // so the default must be SMTP_USER's address, not a store-domain guess.
  expect(lastSendMailOptions().from).toBe(`${DEFAULT_STORE_INFO.name} <${SMTP_ENV.SMTP_USER}>`)
})

test("EMAIL_FROM overrides the derived sender", async () => {
  process.env.EMAIL_FROM = "RJ Jewellers <orders@rjjewellers.in>"

  await sendTestTemplateEmailNow("orderConfirmation")

  expect(lastSendMailOptions().from).toBe("RJ Jewellers <orders@rjjewellers.in>")
})

/**
 * Regression: `docker-compose.yml` declares every optional var as `${VAR:-}`,
 * so an unset one arrives as `""` — not nullish, so a bare `??` keeps it. In
 * production this produced an empty `To` and nodemailer's "No recipients
 * defined" (EENVELOPE) on the very first live send.
 */
test("treats a blank ADMIN_ALERT_EMAIL as unset rather than an empty recipient", async () => {
  process.env.ADMIN_ALERT_EMAIL = ""

  const result = await sendTestTemplateEmailNow("orderConfirmation")

  expect(result.to).not.toBe("")
  expect(result.to).toContain("@")
  expect(lastSendMailOptions().to).toBe(result.to)
})

test("treats a blank EMAIL_FROM as unset rather than an empty sender", async () => {
  process.env.EMAIL_FROM = "   "

  await sendTestTemplateEmailNow("orderConfirmation")

  expect(lastSendMailOptions().from).toBe(`${DEFAULT_STORE_INFO.name} <${SMTP_ENV.SMTP_USER}>`)
})

test("builds the transport on port 587 with pooling, not port 0", async () => {
  await sendTestTemplateEmailNow("orderConfirmation")

  // SMTP_PORT is unset throughout this file, which is the blank/absent case:
  // `Number("")` is 0, so a bare `??` would have dialled port 0 and never
  // connected. Asserted against the first config ever built, since the
  // transport is created once for the whole module.
  const config = transportConfigs[0]
  expect(config).toBeDefined()
  expect(config.port).toBe(587)
  expect(config.secure).toBe(false)
  expect(config.pool).toBe(true)
})

test("a blank SMTP_HOST disables email, as an unset one does", () => {
  process.env.SMTP_HOST = ""
  expect(isEmailEnabled()).toBe(false)
})

test("reuses one pooled transport across sends", async () => {
  await sendTestTemplateEmailNow("orderConfirmation")
  await sendTestTemplateEmailNow("adminAlert")

  expect(sendMail).toHaveBeenCalledTimes(2)
  // Two sends, at most one handshake — the point of pooling.
  expect(createTransport.mock.calls.length).toBeLessThanOrEqual(1)
})

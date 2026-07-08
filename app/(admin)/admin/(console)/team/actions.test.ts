import { beforeEach, expect, mock, test } from "bun:test"

/**
 * Unit tests for the Team server actions (`grantAdmin` / `revokeAdmin`). The
 * admin gate and Supabase client are mocked so nothing hits a real DB; we drive
 * the RPC's returned error to exercise the exception → friendly-copy mapping and
 * the client-side input guards.
 */

const rpc = mock(async (_name: string, _args: unknown) => ({
  data: null as unknown,
  error: null as unknown,
}))

mock.module("@/lib/admin/auth", () => ({ requireAdmin: async () => ({}) }))
mock.module("@/lib/db/server", () => ({
  createServerClient: async () => ({ rpc }),
}))
mock.module("next/cache", () => ({ revalidatePath: () => undefined }))

const { grantAdmin, revokeAdmin } = await import("./actions")

const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99"

beforeEach(() => {
  rpc.mockClear()
  rpc.mockImplementation(async () => ({ data: "ok", error: null }))
})

test("grantAdmin rejects a malformed email before calling the RPC", async () => {
  const res = await grantAdmin("not-an-email")
  expect(res.ok).toBe(false)
  expect(res.error).toContain("valid email")
  expect(rpc).not.toHaveBeenCalled()
})

test("grantAdmin calls admin_grant_role with the trimmed email on a valid input", async () => {
  const res = await grantAdmin("  ravi@example.com  ")
  expect(res.ok).toBe(true)
  expect(res.notice).toBeTruthy()
  expect(rpc).toHaveBeenCalledTimes(1)
  const [name, args] = rpc.mock.calls[0] as [string, { p_email: string }]
  expect(name).toBe("admin_grant_role")
  expect(args.p_email).toBe("ravi@example.com")
})

test("grantAdmin maps NO_ACCOUNT to sign-up guidance", async () => {
  rpc.mockImplementation(async () => ({
    data: null,
    error: { code: "no_data_found", message: "NO_ACCOUNT" },
  }))
  const res = await grantAdmin("ghost@example.com")
  expect(res.ok).toBe(false)
  expect(res.error).toContain("sign up first")
})

test("grantAdmin treats ALREADY_ADMIN as a benign notice, not an error", async () => {
  rpc.mockImplementation(async () => ({
    data: null,
    error: { code: "unique_violation", message: "ALREADY_ADMIN" },
  }))
  const res = await grantAdmin("asha@example.com")
  expect(res.ok).toBe(true)
  expect(res.notice).toContain("already an admin")
  expect(res.error).toBeUndefined()
})

test("revokeAdmin rejects a non-uuid target before calling the RPC", async () => {
  const res = await revokeAdmin("nope")
  expect(res.ok).toBe(false)
  expect(rpc).not.toHaveBeenCalled()
})

test("revokeAdmin maps LAST_ADMIN to a lockout-safe message", async () => {
  rpc.mockImplementation(async () => ({
    data: null,
    error: { code: "check_violation", message: "LAST_ADMIN" },
  }))
  const res = await revokeAdmin(VALID_UUID)
  expect(res.ok).toBe(false)
  expect(res.error).toContain("only remaining admin")
})

test("revokeAdmin maps CANNOT_SELF_REVOKE", async () => {
  rpc.mockImplementation(async () => ({
    data: null,
    error: { code: "check_violation", message: "CANNOT_SELF_REVOKE" },
  }))
  const res = await revokeAdmin(VALID_UUID)
  expect(res.ok).toBe(false)
  expect(res.error).toContain("your own admin access")
})

test("revokeAdmin succeeds on a clean RPC return", async () => {
  const res = await revokeAdmin(VALID_UUID)
  expect(res.ok).toBe(true)
  expect(rpc).toHaveBeenCalledTimes(1)
  const [name, args] = rpc.mock.calls[0] as [string, { p_user_id: string }]
  expect(name).toBe("admin_revoke_role")
  expect(args.p_user_id).toBe(VALID_UUID)
})

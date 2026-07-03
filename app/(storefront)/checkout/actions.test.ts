import { beforeEach, expect, mock, test } from "bun:test";

/**
 * Unit tests for the `submitCheckout` server action — the authoritative checkout
 * gate. The Supabase server client is mocked so nothing hits a real DB; we drive
 * the `place_order` RPC's return to exercise every branch. Focus areas:
 *   - the honeypot drops bots BEFORE the RPC is ever called,
 *   - malformed/invalid input never reaches the RPC,
 *   - the outgoing RPC payload carries NO price (server recomputes totals),
 *   - success and failure returns are mapped correctly.
 */

/** Configurable stand-in for `supabase.rpc("place_order", …)`. */
const rpc = mock(async (_name: string, _args: unknown) => ({
  data: null as unknown,
  error: null as unknown,
}));

/** Mutable session holder — tests flip this to simulate signed in / out. */
const session = {
  user: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99", email: "asha@example.com" } as {
    id: string;
    email: string;
  } | null,
};

const upsertCustomerProfile = mock(async () => ({ ok: true }));

mock.module("@/lib/db/server", () => ({
  createServerClient: async () => ({ rpc }),
  getCurrentUser: async () => session.user,
}));

mock.module("@/lib/db/profile", () => ({ upsertCustomerProfile }));

const { submitCheckout } = await import("./actions");

const validValues = {
  fullName: "Asha Rao",
  phone: "9812345678",
  email: "asha@example.com",
  addressLine: "12 MG Road, Shivaji Nagar",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411001",
  paymentMethod: "cod",
};

const validItems = [
  { productId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", tone: "Gold", qty: 2 },
];

/** A well-formed `place_order` return row (integer paise). */
const rpcOk = {
  order_no: "JR-260703-1001-AB12",
  subtotal_paise: 500000,
  discount_paise: 0,
  shipping_paise: 7900,
  total_paise: 507900,
};

beforeEach(() => {
  rpc.mockClear();
  rpc.mockImplementation(async () => ({ data: null, error: null }));
  upsertCustomerProfile.mockClear();
  session.user = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99",
    email: "asha@example.com",
  };
});

test("declines an unauthenticated submission before touching the DB", async () => {
  session.user = null;

  const result = await submitCheckout({ values: validValues, items: validItems });

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.formError).toContain("sign in");
  expect(rpc).not.toHaveBeenCalled();
});

test("saves the checkout contact as the customer profile on success", async () => {
  rpc.mockImplementation(async () => ({ data: rpcOk, error: null }));

  const result = await submitCheckout({ values: validValues, items: validItems });

  expect(result.ok).toBe(true);
  expect(upsertCustomerProfile).toHaveBeenCalledTimes(1);
  const [userId, profile] = upsertCustomerProfile.mock.calls[0] as unknown as [
    string,
    Record<string, string>,
  ];
  expect(userId).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99");
  expect(profile.fullName).toBe("Asha Rao");
  expect(profile.pincode).toBe("411001");
});

test("drops a submission with a filled honeypot before touching the DB", async () => {
  const result = await submitCheckout({
    values: validValues,
    items: validItems,
    honeypot: "Acme Corp",
  });

  expect(result.ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});

test("treats a whitespace-only honeypot as empty (real user)", async () => {
  rpc.mockImplementation(async () => ({ data: rpcOk, error: null }));

  const result = await submitCheckout({
    values: validValues,
    items: validItems,
    honeypot: "   ",
  });

  expect(result.ok).toBe(true);
  expect(rpc).toHaveBeenCalledTimes(1);
});

test("rejects an empty cart without calling the RPC", async () => {
  const result = await submitCheckout({ values: validValues, items: [] });

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.formError).toContain("out of date");
  expect(rpc).not.toHaveBeenCalled();
});

test("returns a field error for invalid contact details", async () => {
  const result = await submitCheckout({
    values: { ...validValues, phone: "123" },
    items: validItems,
  });

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.fieldErrors.phone).toBeTruthy();
  expect(rpc).not.toHaveBeenCalled();
});

test("never sends a price to the RPC — only product_id, tone, qty", async () => {
  rpc.mockImplementation(async () => ({ data: rpcOk, error: null }));

  await submitCheckout({ values: validValues, items: validItems, honeypot: "" });

  expect(rpc).toHaveBeenCalledTimes(1);
  const [name, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
  expect(name).toBe("place_order");
  const items = args.p_items as Array<Record<string, unknown>>;
  expect(items[0]).toEqual({
    product_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    tone: "Gold",
    qty: 2,
  });
  const serialized = JSON.stringify(args);
  expect(serialized).not.toContain("paise");
  expect(serialized).not.toContain("price");
});

test("maps a successful RPC result to a PlacedOrder", async () => {
  rpc.mockImplementation(async () => ({ data: rpcOk, error: null }));

  const result = await submitCheckout({ values: validValues, items: validItems });

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.order.orderNo).toBe("JR-260703-1001-AB12");
    expect(result.order.totalPaise).toBe(507900);
    expect(result.order.shippingPaise).toBe(7900);
  }
});

test("declines gracefully when the RPC returns an error", async () => {
  rpc.mockImplementation(async () => ({
    data: null,
    error: { message: "db down" },
  }));

  const result = await submitCheckout({ values: validValues, items: validItems });

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.formError).toContain("couldn't place your order");
});

test("flags a failure when the RPC returns an unexpected shape", async () => {
  rpc.mockImplementation(async () => ({
    data: { unexpected: true },
    error: null,
  }));

  const result = await submitCheckout({ values: validValues, items: validItems });

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.formError).toContain("may not have gone through");
});

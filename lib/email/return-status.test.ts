import { expect, test } from "bun:test"
import { resolveEmailCopy } from "./copy"
import {
  buildReturnAdminEmail,
  buildReturnStatusEmail,
  type ReturnEmailKind,
  returnStatusCopyFor,
} from "./return-status"

const base = {
  orderNo: "JR-260706-1001-AB12",
  customerName: "Asha",
  orderUrl: "https://shop.example/account/orders/JR-260706-1001-AB12",
  resolution: "refund" as const,
}

const KINDS: ReturnEmailKind[] = ["Requested", "Approved", "Rejected", "Refunded", "Exchanged"]

test.each(KINDS)("%s email carries order no, name and link in both bodies", (kind) => {
  const msg = buildReturnStatusEmail({ ...base, kind })

  expect(msg.subject).toContain(base.orderNo)
  for (const body of [msg.html, msg.text]) {
    expect(body).toContain(base.orderNo)
    expect(body).toContain("Asha")
    expect(body).toContain(base.orderUrl)
  }
})

test("Approved renders the ship-to address and the shipping-payer note", () => {
  const msg = buildReturnStatusEmail({
    ...base,
    kind: "Approved",
    shippingNote: "Return shipping is arranged and paid by you.",
  })
  for (const body of [msg.html, msg.text]) {
    expect(body).toContain("Ship the piece to")
    expect(body).toContain("Return shipping is arranged and paid by you.")
  }
})

test("Refunded renders the paid amount and the UTR", () => {
  const msg = buildReturnStatusEmail({
    ...base,
    kind: "Refunded",
    refundAmountPaise: 449900,
    refundReference: "415712345678",
  })
  for (const body of [msg.html, msg.text]) {
    expect(body).toContain("₹4,499")
    expect(body).toContain("415712345678")
  }
})

test("Rejected includes the operator's note only when present", () => {
  const withNote = buildReturnStatusEmail({
    ...base,
    kind: "Rejected",
    operatorNote: "The piece shows wear beyond delivery condition.",
  })
  expect(withNote.text).toContain("The piece shows wear beyond delivery condition.")

  const withoutNote = buildReturnStatusEmail({ ...base, kind: "Rejected" })
  expect(withoutNote.text).not.toContain("Note from the store")
})

test("refund details never leak into other kinds", () => {
  const msg = buildReturnStatusEmail({
    ...base,
    kind: "Requested",
    refundAmountPaise: 449900,
    refundReference: "415712345678",
  })
  expect(msg.text).not.toContain("415712345678")
})

test("HTML-escapes customer-derived fields (no injection)", () => {
  const msg = buildReturnStatusEmail({
    ...base,
    kind: "Rejected",
    customerName: '<script>alert("x")</script>',
    operatorNote: "<img src=x onerror=alert(1)>",
  })
  expect(msg.html).not.toContain("<script>")
  expect(msg.html).not.toContain("<img src=x")
})

test("saved copy overrides win over the defaults", () => {
  const copy = resolveEmailCopy({ returnApproved: { heading: "Bring it home" } })
  const msg = buildReturnStatusEmail(
    { ...base, kind: "Approved" },
    undefined,
    returnStatusCopyFor(copy, "Approved"),
  )
  expect(msg.html).toContain("Bring it home")
})

test("admin alert names the order, ask and reason, escaped", () => {
  const msg = buildReturnAdminEmail({
    orderNo: base.orderNo,
    customerName: "Asha",
    resolution: "exchange",
    reason: "Clasp arrived broken <b>!</b>",
    adminUrl: "https://shop.example/admin/returns",
  })
  expect(msg.subject).toContain(base.orderNo)
  expect(msg.subject).toContain("Exchange")
  expect(msg.text).toContain("Clasp arrived broken")
  expect(msg.html).toContain("&lt;b&gt;")
  expect(msg.html).toContain("https://shop.example/admin/returns")
})

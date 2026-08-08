import { expect, test } from "bun:test"
import { resolveReviews, type CustomerOrderRow, type CustomerReviewRow } from "./customers"

const JHUMKA = "83c95904-jhumka"
const KADA = "d418e472-kada"

/** Newest-first, as the detail query returns them. */
function order(orderNo: string, productIds: (string | null)[]): CustomerOrderRow {
  return {
    order_no: orderNo,
    status: "Delivered",
    created_at: "2026-08-08T10:00:00Z",
    total_paise: 100000,
    order_item: productIds.map((product_id, i) => ({
      name: `Item ${i}`,
      qty: 1,
      line_total_paise: 50000,
      product_id,
    })),
  }
}

function review(productId: string, rating = 5): CustomerReviewRow {
  return {
    product_id: productId,
    rating,
    title: "Lovely",
    body: "Great piece.",
    created_at: "2026-08-08T12:00:00Z",
  }
}

test("attaches a review to the line item for its product", () => {
  const [out] = resolveReviews([order("JR-1", [JHUMKA])], [review(JHUMKA)])

  expect(out.items[0].review?.rating).toBe(5)
  expect(out.items[0].reviewedOnOrderNo).toBeNull()
})

test("leaves unreviewed items with no review and no back-reference", () => {
  const [out] = resolveReviews([order("JR-1", [JHUMKA, KADA])], [review(JHUMKA)])

  expect(out.items[1].review).toBeNull()
  expect(out.items[1].reviewedOnOrderNo).toBeNull()
})

test("a repurchased product shows its review only once, on the earliest order", () => {
  // The bug this guards: `review` has no order_id, so a naive product-id join
  // renders the same review under every order containing that product. Live in
  // the real data — one buyer has three products spanning two orders each.
  const orders = [order("JR-NEWER", [JHUMKA]), order("JR-OLDER", [JHUMKA])]

  const [newer, older] = resolveReviews(orders, [review(JHUMKA)])

  expect(older.items[0].review?.rating).toBe(5)
  expect(newer.items[0].review).toBeNull()
  expect(newer.items[0].reviewedOnOrderNo).toBe("JR-OLDER")
})

test("a review with no matching order line is simply absent", () => {
  const [out] = resolveReviews([order("JR-1", [KADA])], [review(JHUMKA)])

  expect(out.items[0].review).toBeNull()
  expect(out.items[0].reviewedOnOrderNo).toBeNull()
})

test("survives a line item whose product was deleted (null product_id)", () => {
  const [out] = resolveReviews([order("JR-1", [null, JHUMKA])], [review(JHUMKA)])

  expect(out.items[0].review).toBeNull()
  expect(out.items[1].review?.rating).toBe(5)
})

test("preserves the newest-first order it was given", () => {
  const out = resolveReviews([order("JR-A", [JHUMKA]), order("JR-B", [KADA])], [])

  expect(out.map((o) => o.orderNo)).toEqual(["JR-A", "JR-B"])
})

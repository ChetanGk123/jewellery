import { expect, test } from "@playwright/test";

/**
 * E2E: the storefront's critical journey (TASKS — Testing):
 * browse → product → add to cart → checkout (COD) → confirmation.
 *
 * Runs against a production build (see playwright.config.ts), so the strict
 * nonce CSP and per-request rendering are exercised for real.
 *
 * ⚠️ Writes a REAL order into the live Supabase project. Every test order is
 * tagged with `E2E_EMAIL` so it can be removed afterwards with:
 *   delete from "order" where customer_email = 'e2e-test@example.com';
 * (order_item rows cascade).
 */

/** Tag for all E2E-created orders — the cleanup key. */
const E2E_EMAIL = "e2e-test@example.com";

/** Matches the server-generated order number: JR-YYMMDD-####-XXXX. */
const ORDER_NO_RE = /JR-\d{6}-\d{4,}-[0-9A-Z]{4}/;

test("home page loads with hero heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
});

test("browse → add to cart → COD checkout → confirmation", async ({ page }) => {
  // Browse: shop listing → first product.
  await page.goto("/shop");
  const firstProduct = page.locator('a[href^="/product/"]').first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();
  await expect(page).toHaveURL(/\/product\//);

  // Add to cart via the buy box. Related-product cards render their own
  // quick-"Add" buttons with the same aria-label pattern, so narrow by the
  // buy box's full visible text ("Add to Cart", later "Added to cart ✓").
  const addButton = page
    .getByRole("button", { name: /add .* to cart/i })
    .filter({ hasText: /^add(ed)? to cart/i });
  await addButton.click();
  await expect(addButton).toHaveText(/added to cart/i);

  // Cart: the line is present, proceed to checkout.
  await page.goto("/cart");
  await expect(page.getByRole("link", { name: /proceed to checkout/i })).toBeVisible();
  await page.getByRole("link", { name: /proceed to checkout/i }).click();
  await expect(page).toHaveURL(/\/checkout/);

  // Checkout: fill the COD form (labels are sr-only, matching placeholders).
  await page.getByLabel("Full name").fill("E2E Test");
  await page.getByLabel("Phone (10 digits)").fill("9812345678");
  await page.getByLabel("Email (for order updates)").fill(E2E_EMAIL);
  await page.getByLabel("Address (house no, street, area)").fill("12 Test Lane, QA Nagar");
  await page.getByLabel("City").fill("Pune");
  await page.getByLabel("State").fill("Maharashtra");
  await page.getByLabel("Pincode").fill("411001");

  // Place the order — the server recomputes totals and returns the order no.
  await page.getByRole("button", { name: /place order/i }).click();

  // Confirmation: thank-you view with the unguessable order number in the URL.
  await expect(page.getByText("Thank you for your order!")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).toHaveURL(new RegExp(`/order/JR-`));
  await expect(page.getByText(ORDER_NO_RE).first()).toBeVisible();

  // The cart was cleared by the redirect.
  await page.goto("/cart");
  await expect(page.getByText(/your cart is empty/i)).toBeVisible();
});

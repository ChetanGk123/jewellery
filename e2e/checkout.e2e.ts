import { expect, test, type Page } from "@playwright/test";

/**
 * E2E: the storefront's critical journey (TASKS — Testing):
 * sign in → browse → product → add to cart → checkout (COD) → confirmation.
 *
 * Runs against a production build (see playwright.config.ts), so the strict
 * nonce CSP and per-request rendering are exercised for real. Checkout is
 * sign-in only, so the journey authenticates first with the seeded test
 * account (E2E_USER_EMAIL / E2E_USER_PASSWORD from .env.local — Bun injects
 * them when the suite runs via `bun run e2e`).
 *
 * ⚠️ Writes a REAL order into the live Supabase project. Every test order is
 * tagged with `E2E_EMAIL` so it can be removed afterwards with:
 *   delete from "order" where customer_email = 'chetangkajjidoni+e2e@gmail.com';
 * (order_item rows cascade).
 */

/** Tag for all E2E-created orders — the cleanup key (also the test account). */
const E2E_EMAIL = process.env.E2E_USER_EMAIL ?? "chetangkajjidoni+e2e@gmail.com";
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD ?? "";

/** Matches the server-generated order number: JR-YYMMDD-####-XXXX. */
const ORDER_NO_RE = /JR-\d{6}-\d{4,}-[0-9A-Z]{4}/;

/** Sign in with the seeded test account via the password form. */
async function signIn(page: Page) {
  await page.goto("/sign-in");
  // Exact match — the footer newsletter input is also labelled "Email address".
  await page.getByLabel("Email", { exact: true }).fill(E2E_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // Default post-auth target is the account page.
  await page.waitForURL(/\/account/);
}

test("home page loads with hero heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
});

test("checkout requires sign-in when logged out", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fcheckout/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("sign in → browse → add to cart → COD checkout → confirmation", async ({
  page,
}) => {
  test.skip(!E2E_PASSWORD, "E2E_USER_PASSWORD not set in .env.local");

  await signIn(page);

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

  // Checkout: email arrives prefilled from the account; fill the rest of the
  // COD form (labels are sr-only, matching placeholders).
  await expect(page.getByLabel("Email (for order updates)")).toHaveValue(E2E_EMAIL);
  await page.getByLabel("Full name").fill("E2E Test");
  await page.getByLabel("Phone (10 digits)").fill("9812345678");
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

  // And the order shows up in My Orders (RLS-scoped to this account).
  await page.goto("/account/orders");
  await expect(page.getByText(ORDER_NO_RE).first()).toBeVisible();
});

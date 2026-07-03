import { defineConfig, devices } from "@playwright/test";

/** Port for the E2E production server — off 3000 so a dev server can coexist. */
const E2E_PORT = 3200;

/**
 * Playwright E2E config (TASKS — Testing). Tests run against a real
 * PRODUCTION build (`next build` + `next start`), not the dev server, so the
 * strict nonce CSP, proxy headers, and per-request rendering are all exercised
 * exactly as they would ship.
 *
 * Files are named `*.e2e.ts` (not `*.test.ts` / `*.spec.ts`) so `bun test`
 * never tries to execute them — Bun's runner matches both of those suffixes.
 *
 * Data note: the checkout journey writes a REAL order via `place_order` into
 * the live Supabase project (no staging project exists yet). Test orders are
 * tagged with `E2E_EMAIL` (see e2e/checkout.e2e.ts) so they can be deleted
 * with one SQL statement afterwards.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  expect: {
    toHaveScreenshot: {
      // Kill CSS animations/transitions mid-flight so captures are stable.
      animations: "disabled",
      // Tolerate sub-pixel antialiasing drift across runs/machines.
      maxDiffPixelRatio: 0.02,
    },
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    // Uses the system-installed Chrome (`channel: "chrome"`) so no Playwright
    // browser download is needed. Add firefox/webkit projects if/when those
    // browsers are installed via `playwright install`.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: `bun run build && PORT=${E2E_PORT} bun run start`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

import { expect, test } from "@playwright/test";

/**
 * Visual regression (TASKS — Testing): full-page screenshots of the key
 * storefront surfaces at the four project breakpoints (320 / 768 / 1024 /
 * 1440 — see .claude/rules web testing). Baselines live in
 * `visual.e2e.ts-snapshots/` and are committed; `toHaveScreenshot` diffs
 * against them with animations disabled (see playwright.config.ts).
 *
 * Surfaces are chosen to be DETERMINISTIC: they render seed-data products and
 * static copy only — no checkout writes, no clock-sensitive UI (the footer
 * year changes at most once a year; regenerate baselines then).
 *
 * Regenerate baselines after an intentional design change with:
 *   bun run e2e -- --update-snapshots
 */

/** Project breakpoints (px) from the web testing rules. */
const BREAKPOINTS = [320, 768, 1024, 1440] as const;

/** Deterministic pages: path + a slug for the snapshot filename. */
const SURFACES = [
  { path: "/", name: "home" },
  { path: "/shop", name: "shop" },
  { path: "/product/kundan-rani-haar-set", name: "product" },
  { path: "/cart", name: "cart-empty" },
] as const;

for (const width of BREAKPOINTS) {
  test.describe(`viewport ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const surface of SURFACES) {
      test(`${surface.name} matches baseline`, async ({ page }) => {
        await page.goto(surface.path);
        // Let remote (Supabase storage) images finish decoding before capture.
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`${surface.name}-${width}.png`, {
          fullPage: true,
        });
      });
    }
  });
}

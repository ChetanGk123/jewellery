/**
 * Shared design constants that are consumed in JS/TSX (not just CSS) — kept
 * here so a single edit updates every usage.
 */

/**
 * Warm gradient shown as a placeholder behind products and categories that have
 * no real photo yet (seed data ships gradients, not images). Used in inline
 * `style={{ background }}` on the product card and category tiles.
 */
export const PLACEHOLDER_GRADIENT =
  "linear-gradient(150deg,#F3EEE0,#E3D6BA 55%,#D2BE90)";

/**
 * Renders a JSON-LD `<script>` block (TASKS 4.16 — Organization + Product
 * structured data). `dangerouslySetInnerHTML` is safe here: `data` is always a
 * server-built plain object (`JSON.stringify`'d schema.org shape from static
 * brand info or our own DB rows), never raw user input. Nonce'd so the strict
 * CSP (`script-src 'nonce-…' 'strict-dynamic'` in production) doesn't drop it.
 *
 * `suppressHydrationWarning`: browsers deliberately hide a `<script>`'s real
 * `nonce` value from DOM readback once parsed (`getAttribute('nonce')` always
 * returns `""` — a CSP anti-leakage measure, not a bug), so React's hydration
 * check sees the server-rendered nonce string vs. the client's hidden `""`
 * and flags a mismatch. The nonce is still applied correctly by the browser
 * before it's hidden; this is an expected, cosmetic-only warning.
 */
export function JsonLd({ data, nonce }: { data: object; nonce?: string }) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

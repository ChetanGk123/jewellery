/**
 * Renders a JSON-LD `<script>` block (TASKS 4.16 — Organization + Product
 * structured data). `dangerouslySetInnerHTML` is safe here: `data` is always a
 * server-built plain object (`JSON.stringify`'d schema.org shape from static
 * brand info or our own DB rows), never raw user input. Nonce'd so the strict
 * CSP (`script-src 'nonce-…' 'strict-dynamic'` in production) doesn't drop it.
 */
export function JsonLd({ data, nonce }: { data: object; nonce?: string }) {
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

import "server-only"
import { headers } from "next/headers"

/**
 * The per-request CSP nonce (TASKS 4.16), minted in `proxy.ts` and forwarded
 * as the `x-nonce` request header. Next.js auto-stamps its own bootstrap
 * scripts with it; any hand-written inline `<script>` (e.g. JSON-LD) must be
 * nonce'd the same way or a strict `script-src` may drop it.
 */
export async function getNonce(): Promise<string | undefined> {
  const headerList = await headers()
  return headerList.get("x-nonce") ?? undefined
}

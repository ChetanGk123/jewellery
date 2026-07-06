import { mock } from "bun:test";

/**
 * `import "server-only"` is a build-time marker Next.js special-cases; the
 * package isn't installed, so bun test can't resolve it. Stub it globally so
 * unit tests can import server modules (preloaded via bunfig.toml).
 */
mock.module("server-only", () => ({}));

/**
 * Server Actions call Next's cache invalidation APIs, which throw outside a
 * real request/action context (`updateTag can only be called from within a
 * Server Action`). Unit tests exercise the action logic, not the framework
 * cache, so stub them as no-ops.
 */
mock.module("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  updateTag: () => undefined,
  refresh: () => undefined,
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

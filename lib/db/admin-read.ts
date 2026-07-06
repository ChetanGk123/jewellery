import "server-only";

/**
 * Result envelope for every admin console read (TASKS 5.1). Carries the loaded
 * data plus an `error` flag the views render as a visible "Couldn't load"
 * banner instead of a healthy-looking empty state — the whole point of the
 * audit's C1 finding: a DB outage / RLS regression / expired session must not
 * masquerade as "0 orders today".
 */
export type AdminRead<T> = { data: T; error: boolean };

/**
 * Run an admin read, logging any failure server-side and degrading to `fallback`
 * with `error: true`. Centralises the `try { … } catch { return EMPTY }` that
 * used to be duplicated (and silent) across all ten `admin-*` modules.
 */
export async function loadAdmin<T>(
  label: string,
  load: () => Promise<T>,
  fallback: T,
): Promise<AdminRead<T>> {
  try {
    return { data: await load(), error: false };
  } catch (err) {
    console.error(`[admin-read] ${label} failed:`, err);
    return { data: fallback, error: true };
  }
}

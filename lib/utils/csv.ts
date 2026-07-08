/**
 * Minimal CSV escaping (TASKS 5.10 / 5.18) shared by the admin export
 * actions (subscribers, orders). Client-safe — no server deps.
 */

/** Escape a value for a CSV cell — quote and double any embedded quotes. */
export function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** Join one row of cells into an escaped CSV line. */
export function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(",")
}

/**
 * Which printable document `/admin/orders/[orderNo]/print` renders (5.12
 * follow-up: invoice and packing slip are separate print surfaces, selected
 * via `?doc=`). Pure constants — imported by the route registry and client
 * components, so no server-only code here.
 */
export const PRINT_DOCS = ["invoice", "packing-slip"] as const;

export type PrintDoc = (typeof PRINT_DOCS)[number];

/** Coerce the raw `?doc=` search param; anything unknown falls back to the invoice. */
export function toPrintDoc(value: string | undefined): PrintDoc {
  return PRINT_DOCS.includes(value as PrintDoc) ? (value as PrintDoc) : "invoice";
}

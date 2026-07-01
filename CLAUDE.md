# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## RULE: Reference the prototypes before generating any UI

**Before generating, scaffolding, or editing any UI component, page, or layout, you
MUST reference the relevant prototype in [`refereces/`](refereces/) and mirror its
actual design** — layout, spacing, copy, colors, typography, component structure, and
interaction/hover states. Do **not** design UI from imagination or generic templates
when a prototype exists.

- [`refereces/JR Jewellers Storefront.html`](refereces/JR%20Jewellers%20Storefront.html) — customer storefront.
- [`refereces/JR Admin Dashboard.html`](refereces/JR%20Admin%20Dashboard.html) — admin console.

These are builder exports: the `.html` is encoded and only renders when its JS
**self-unpacks in a real browser** — reading the file directly shows the bootstrap,
not the design. So do **both**:

1. **Decode the DSL for structure** — parse the `__bundler/template` section (see
   "Reading / decoding the prototypes" below) to get exact layout, copy, and bindings.
2. **Render the screen in a browser for visual fidelity** — load the `.html` (via the
   Chrome DevTools MCP or `python3 -m http.server`), let it unpack, and study the
   real spacing/color/typography/hover states before building the React/Tailwind version.

Only deviate when the user explicitly asks, or when the prototype has no equivalent
for what's being built.

## Project status

This repo is **mid-transition**: it currently contains two finished UI prototypes
and an approved plan to rebuild them as one app. There is **no application code,
`package.json`, build, or test suite yet**, and it is **not a git repository**.

- `refereces/JR Jewellers Storefront.html` (~426 KB) — customer storefront prototype.
- `refereces/JR Admin Dashboard.html` (~486 KB) — admin console prototype.
- `ARCHITECTURE_PLAN.md` — **the rebuild plan; read this first.** Recreates both
  prototypes as a single **Next.js (App Router) + TypeScript + Tailwind + Supabase**
  app. Confirmed decisions: Supabase backend; **storefront-first**; **COD-only for
  v1** (Razorpay/Shiprocket deferred to a later phase). It also contains the full
  domain model, design tokens, route structure, and a phased roadmap.

When asked to "build", "scaffold", or "start", follow `ARCHITECTURE_PLAN.md` —
do not invent a different stack or structure.

## The prototypes are builder exports, not editable source

Each `.html` is the bundled output of a visual/no-code builder. Do **not** try to
hand-edit them; the real content is encoded. Anatomy of each file:

- Bootstrap `<script>` that unpacks the app into the DOM on load (`Unpacking...`
  indicator; errors show in a red `#__bundler_err` overlay + console).
- `<script type="__bundler/manifest">` — JSON whose `data` fields are
  **gzip + base64** payloads (start with `H4sI`). This is the **shared React
  runtime engine + woff2 fonts** — byte-identical between the two files and **not
  reused** in the rebuild.
- `<script type="__bundler/template">` — a JSON-string-encoded HTML template; the
  app's actual UI/logic lives here in a custom DSL.

### Template DSL (where all UI intelligence is)

`<x-dc>` root wrapper · `<dc-import name="ProductCard">` component include ·
`<sc-if value="{{ ... }}">` conditional · `<sc-for list="{{ ... }}" as="x">` loop ·
`<helmet>` head content · `{{ binding }}` interpolation · `style-hover="..."` hover.

Both apps are **SPA routers driven by `sc-if`** — e.g. storefront views switch on
`{{ isHome }}`/`{{ isCategory }}`/`{{ isProduct }}`/`{{ isCart }}`/`{{ isCheckout }}`…;
admin on `{{ isDash }}`/`{{ isOrders }}`/`{{ isProducts }}`/`{{ isSettings }}`… In the
Next.js rebuild these become real routes (see plan §4).

## Reading / decoding the prototypes

To extract the human-readable template DSL (and, if needed, the runtime JS) for a
file, parse the embedded scripts and gunzip the manifest payloads, e.g.:

```python
import re, json, base64, gzip
data = open("refereces/JR Jewellers Storefront.html").read()
tpl = json.loads(re.search(r'type="__bundler/template">\s*(".*?")\s*</script>', data, re.S).group(1))
# -> tpl is the readable DSL with all pages/components/bindings
```

- **Preview** a prototype: open the `.html` in a browser, or `python3 -m http.server`
  and load it (it self-unpacks via JS).
- Treat the prototypes as the **visual + behavioral spec** for the rebuild. When
  reproducing a screen, decode its template section and mirror the layout, copy,
  and bindings rather than guessing.

## Brand / design tokens (carry into the rebuild)

- Fonts: **Marcellus** (logo/display), **Cormorant Garamond** (headings),
  **Jost** (UI/body).
- Palette: maroon `#2A0A12`/`#2A1115`/`#4A0E1C`/`#71182B`; gold `#E6CA7E`/`#C9A24B`/
  `#A87A1E`/`#B58A3C`; cream `#FBF6EE`/`#FFFDF8`/`#F3E3C7`.
- Storefront uses sharp 2–4px radii (luxe); admin uses softer 8–12px cards.
- Context: Indian market — prices in **₹ (INR)**, COD, GSTIN, WhatsApp enquiry.
  Store money as **integer paise**; format only in the UI layer (see plan §2).

The full token set and the proposed `src/` layout are in `ARCHITECTURE_PLAN.md`
(§4–§5) — reuse them instead of redefining.

# Auth email templates

Branded Supabase Auth (GoTrue) email templates for RJ Jewellers, replacing the
bare default one-liners (see TASKS 2.8b). They mirror the storefront UI: maroon
`#2A1115` brand band with the gold wordmark, cream `#FBF6EE` background,
`#FFFDF8` card with `#E7D9C2` hairlines, gold-gradient CTA, sharp 2–4px radii,
Cormorant Garamond headings / Jost body (with Georgia + system-sans fallbacks —
most email clients won't load web fonts, so the fallbacks carry the design).

| File | Dashboard template | Link `type` | Extras |
| --- | --- | --- | --- |
| `magic-link.html` | Magic Link | `magiclink` | one-time `{{ .Token }}` code (sign-in page accepts it) |
| `confirm-signup.html` | Confirm signup | `signup` | — |
| `reset-password.html` | Reset password | `recovery` | callback routes to `/account/reset-password` |
| `email-change.html` | Change email address | `email_change` | shows `{{ .Email }}` → `{{ .NewEmail }}` |

All links go through the app's own callback —
`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=…` — which
`app/auth/callback/route.ts` verifies **server-side** (works in any browser, no
PKCE verifier or redirect-URL allowlist dependency).

## Applying

Either:

- **Script (recommended):** `SUPABASE_ACCESS_TOKEN=sbp_... ./supabase/templates/apply.sh`
  (personal access token from <https://supabase.com/dashboard/account/tokens>;
  sets subjects + bodies for all four in one PATCH), or
- **Dashboard:** Authentication → Email Templates → paste each file's HTML and
  the subject from `apply.sh`.

## Gotchas

- **Site URL** (Authentication → URL Configuration) must point at the real app
  origin (`http://localhost:3000` in dev, production URL at deploy) — it feeds
  `{{ .SiteURL }}` in every link.
- Templates are Go templates; keep the `{{ .X }}` variables intact when editing.
- **Code length:** `{{ .Token }}` length comes from Authentication → Providers →
  Email → *Email OTP Length* (this project currently sends 8 digits). The
  sign-in form accepts 6–10, so any setting works; change the dashboard value
  if you want shorter codes.
- Inline styles + table layout are deliberate (email-client compatibility);
  don't refactor to classes/flexbox.
- These cover **auth** emails only. Order-confirmation email (the confirmation
  page says "a confirmation has been sent") is not implemented yet — needs an
  email provider (e.g. Resend) in a later phase.

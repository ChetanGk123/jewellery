#!/usr/bin/env bash
#
# Push the branded auth email templates (+ subjects) to the Supabase project
# via the Management API. One-shot alternative to pasting each template into
# Dashboard → Authentication → Email Templates.
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_... ./supabase/templates/apply.sh
#
# Get a token at https://supabase.com/dashboard/account/tokens (do NOT commit it).
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN — create one at https://supabase.com/dashboard/account/tokens}"

PROJECT_REF="naolegptozpaiojozzcy" # jr-jewellers (ap-south-1)
DIR="$(cd "$(dirname "$0")" && pwd)"

# JSON-string-encode a file's contents.
json_file() {
  python3 -c 'import json,sys; print(json.dumps(open(sys.argv[1]).read()))' "$1"
}

payload=$(cat <<EOF
{
  "mailer_subjects_confirmation": "Confirm your email — RJ Jewellers",
  "mailer_templates_confirmation_content": $(json_file "$DIR/confirm-signup.html"),
  "mailer_subjects_magic_link": "Your sign-in code for RJ Jewellers",
  "mailer_templates_magic_link_content": $(json_file "$DIR/magic-link.html"),
  "mailer_subjects_recovery": "Reset your RJ Jewellers password",
  "mailer_templates_recovery_content": $(json_file "$DIR/reset-password.html"),
  "mailer_subjects_email_change": "Confirm your new email — RJ Jewellers",
  "mailer_templates_email_change_content": $(json_file "$DIR/email-change.html")
}
EOF
)

echo "Applying 4 email templates to project $PROJECT_REF ..."
http_code=$(curl -sS -o /tmp/supabase-mailer-response.json -w "%{http_code}" \
  -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$payload")

if [ "$http_code" != "200" ]; then
  echo "FAILED (HTTP $http_code):" >&2
  cat /tmp/supabase-mailer-response.json >&2
  exit 1
fi

echo "Done — Magic Link, Confirm signup, Reset password and Email change templates updated."

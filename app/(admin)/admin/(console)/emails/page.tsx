import type { Metadata } from "next"
import { EmailsView } from "@/components/admin/emails/EmailsView"
import { emailCopyToFormValues } from "@/lib/admin/email-copy"
import { ADMIN_PAGE_META } from "@/lib/admin/nav"
import { getRawEmailCopy, getStoreInfo } from "@/lib/db/settings"
import { adminAlertTo, isEmailEnabled } from "@/lib/email/send"
import { ROUTES } from "@/lib/routes"
import { SITE_URL } from "@/lib/site-url"

export const metadata: Metadata = {
  title: ADMIN_PAGE_META[ROUTES.adminEmails].title,
}

/**
 * Emails console (TASKS 7.5). Loads the saved `email_copy` blob + resolved
 * store identity server-side and seeds the client `EmailsView`, which renders
 * live previews entirely in the browser (the builders are pure). Saving goes
 * through `updateEmailCopy`; test sends through `sendTestEmail`.
 */
export default async function AdminEmailsPage() {
  const [rawEmailCopy, info] = await Promise.all([getRawEmailCopy(), getStoreInfo()])
  return (
    <EmailsView
      initial={emailCopyToFormValues(rawEmailCopy)}
      storeInfo={info}
      baseUrl={SITE_URL}
      isEmailConfigured={isEmailEnabled()}
      testRecipient={adminAlertTo(info)}
    />
  )
}

/**
 * Sample fixtures for every email template (TASKS 7.4). One entry point,
 * `buildSampleEmail`, renders a template with realistic demo data — shared by
 * the admin Emails console's live preview (client) and the "Send test email"
 * action (server), so what the operator previews is exactly what the test
 * send delivers. Pure: fixed dates/amounts, no clocks, no server-only deps.
 */

import { buildAbandonedCartEmail } from "./abandoned-cart"
import { buildNewOrderAdminEmail } from "./admin-alert"
import type { EmailCopy, EmailTemplateId } from "./copy"
import { buildDailyDigestEmail } from "./daily-digest"
import { buildOrderConfirmationEmail, type EmailMessage } from "./order-confirmation"
import { buildOrderStatusEmail, type OrderStatusEmailKind, orderStatusCopyFor } from "./order-status"
import { buildSubscriberWelcomeEmail } from "./subscriber-welcome"
import { ROUTES } from "@/lib/routes"
import type { ResolvedStoreInfo } from "@/lib/store-info"

export type SampleEmailContext = {
  info: ResolvedStoreInfo
  copy: EmailCopy
  /** Absolute site origin for the links (SITE_URL server-side). */
  baseUrl: string
}

/** Fixed demo order — realistic bridal-jewellery data, no clocks. */
const ORDER_NO = "JR-260709-1042-KX3P"
const CUSTOMER = "Asha Rao"
const ITEMS = [
  { name: "Kundan Bridal Choker Set", tone: "Rose Gold", qty: 1, lineTotalPaise: 449900 },
  { name: "Polki Jhumka Earrings", tone: null, qty: 2, lineTotalPaise: 259800 },
]
const SUBTOTAL_PAISE = 709700
const DISCOUNT_PAISE = 70900
const TOTAL_PAISE = SUBTOTAL_PAISE - DISCOUNT_PAISE

/**
 * The status kinds share the order fixture; Shipped carries an AWB (tracking
 * row) and Delivered carries items (review invitations) so each preview shows
 * its kind-specific extras.
 */
function buildStatusSample(kind: OrderStatusEmailKind, ctx: SampleEmailContext): EmailMessage {
  const { info, copy, baseUrl } = ctx
  const orderUrl = `${baseUrl}${ROUTES.order(ORDER_NO)}`
  return buildOrderStatusEmail(
    {
      kind,
      orderNo: ORDER_NO,
      customerName: CUSTOMER,
      totalPaise: TOTAL_PAISE,
      orderUrl,
      awb: kind === "Shipped" ? "AWB1234567890" : null,
      trackingUrl: kind === "Shipped" ? orderUrl : null,
      items:
        kind === "Delivered"
          ? ITEMS.map((it) => ({ name: it.name, reviewUrl: `${baseUrl}${ROUTES.shop}` }))
          : undefined,
    },
    info,
    orderStatusCopyFor(copy, kind),
  )
}

/** Render one template with its sample data. */
export function buildSampleEmail(id: EmailTemplateId, ctx: SampleEmailContext): EmailMessage {
  const { info, copy, baseUrl } = ctx
  const orderUrl = `${baseUrl}${ROUTES.order(ORDER_NO)}`

  switch (id) {
    case "orderShipped":
      return buildStatusSample("Shipped", ctx)
    case "orderDelivered":
      return buildStatusSample("Delivered", ctx)
    case "orderCancelled":
      return buildStatusSample("Cancelled", ctx)
    case "orderConfirmation":
      return buildOrderConfirmationEmail(
        {
          orderNo: ORDER_NO,
          customerName: CUSTOMER,
          addressLine: "12 MG Road, Shivaji Nagar",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          totalPaise: TOTAL_PAISE,
          orderUrl,
          items: ITEMS,
          subtotalPaise: SUBTOTAL_PAISE,
          discountPaise: DISCOUNT_PAISE,
          shippingPaise: 0,
        },
        info,
        copy.orderConfirmation,
      )
    case "adminAlert":
      return buildNewOrderAdminEmail(
        {
          orderNo: ORDER_NO,
          customerName: CUSTOMER,
          city: "Bengaluru",
          state: "Karnataka",
          itemCount: 3,
          totalPaise: TOTAL_PAISE,
          adminUrl: `${baseUrl}${ROUTES.adminOrders}`,
        },
        info,
        copy.adminAlert,
      )
    case "abandonedCart":
      return buildAbandonedCartEmail(
        {
          cartUrl: `${baseUrl}${ROUTES.cart}`,
          items: ITEMS.map((it) => ({
            name: it.name,
            qty: it.qty,
            unitPricePaise: Math.round(it.lineTotalPaise / it.qty),
            tone: it.tone,
            productUrl: `${baseUrl}${ROUTES.shop}`,
          })),
        },
        info,
        copy.abandonedCart,
      )
    case "subscriberWelcome":
      return buildSubscriberWelcomeEmail(
        { shopUrl: `${baseUrl}${ROUTES.shop}` },
        info,
        copy.subscriberWelcome,
      )
    case "dailyDigest":
      return buildDailyDigestEmail(
        {
          dateIso: "2026-07-09",
          orders: 4,
          cancelled: 1,
          revenuePaise: 2154600,
          pendingOrders: 3,
          lowStockCount: 2,
          lowStock: [
            { name: "Kundan Bridal Choker Set", sku: "JR-NK-014", stock: 1 },
            { name: "Polki Jhumka Earrings", sku: "JR-ER-002", stock: 3 },
          ],
          adminUrl: `${baseUrl}${ROUTES.admin}`,
        },
        info,
        copy.dailyDigest,
      )
  }
}

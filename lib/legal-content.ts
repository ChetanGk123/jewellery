/**
 * Static copy for the legal pages (Privacy Policy, Terms of Use,
 * Cancellation & Refund Policy) — added in Phase 4.2 to close a compliance
 * gap flagged in `STOREFRONT_SHORTFALLS.md` (India's Consumer Protection
 * (E-Commerce) Rules, 2020 require published return/refund terms and a
 * grievance contact). Kept in one module, same pattern as `help-content.ts`,
 * so the page components stay presentational.
 *
 * Business identity/contact details come from `@/lib/store-info` — the
 * single source of truth.
 */

export const LEGAL_LAST_UPDATED = "5 July 2026"

export type LegalSectionData = {
  heading: string
  paragraphs: string[]
  list?: { items: string[]; ordered?: boolean }
}

export const PRIVACY_SECTIONS: LegalSectionData[] = [
  {
    heading: "Overview",
    paragraphs: [
      "This policy explains what personal information RJ Jewellers collects when you use this website, why we collect it, and the choices you have. By using the site or placing an order, you agree to the practices described here.",
    ],
  },
  {
    heading: "Information we collect",
    paragraphs: [
      "We collect information you give us directly and a small amount of information collected automatically.",
    ],
    list: {
      items: [
        "Account details — name, email address, phone number, and the delivery address you save to your profile.",
        "Order details — items purchased, delivery address, and order value, kept against your account and shared only as needed to fulfil the order.",
        "Contact-form and enquiry details — the name, email, phone, and message you submit via our Contact page or WhatsApp.",
        "Usage information — basic technical data such as browser type and pages visited, used only to keep the site secure and working correctly.",
      ],
    },
  },
  {
    heading: "How we use your information",
    paragraphs: ["We use the information above to:"],
    list: {
      items: [
        "Create and manage your account and order history.",
        "Process, pack, and deliver your orders, including Cash on Delivery.",
        "Respond to enquiries submitted via the Contact page or WhatsApp.",
        "Send you order-related updates and, if you've opted in, occasional offers and new-arrival emails (you can unsubscribe at any time).",
        "Detect and prevent fraud or abuse of the checkout and enquiry forms.",
      ],
    },
  },
  {
    heading: "Sharing your information",
    paragraphs: [
      "We do not sell your personal information. We share it only where necessary to run the store:",
    ],
    list: {
      items: [
        "With our infrastructure and database provider (Supabase), which stores your account and order data securely on our behalf.",
        "With logistics partners once your order ships, so they can deliver it and provide tracking.",
        "When required by law, regulation, or a valid legal request.",
      ],
    },
  },
  {
    heading: "Cookies",
    paragraphs: [
      "We use essential cookies to keep you signed in and to remember the contents of your cart between visits. We do not use third-party advertising or tracking cookies.",
    ],
  },
  {
    heading: "Data security",
    paragraphs: [
      "Your data is stored with row-level access controls, and all traffic to this site is encrypted (HTTPS). No online payment details are collected or stored — orders are Cash on Delivery only.",
    ],
  },
  {
    heading: "Your rights and choices",
    paragraphs: [
      "You can review and update your profile details at any time from your Account page. To request a copy of your data, ask us to correct it, or ask us to delete your account, email us using the contact details below and we will respond within a reasonable time.",
    ],
  },
  {
    heading: "Children's privacy",
    paragraphs: [
      "This site is not directed at children, and we do not knowingly collect personal information from anyone under 18.",
    ],
  },
  {
    heading: "Changes to this policy",
    paragraphs: [
      'We may update this policy from time to time. The "last updated" date at the top of this page reflects the most recent revision. Continued use of the site after a change means you accept the updated policy.',
    ],
  },
]

export const TERMS_SECTIONS: LegalSectionData[] = [
  {
    heading: "Acceptance of terms",
    paragraphs: [
      "These Terms of Use govern your access to and use of the RJ Jewellers website and your purchase of products through it. By browsing the site or placing an order, you agree to be bound by these terms.",
    ],
  },
  {
    heading: "About our products",
    paragraphs: [
      "All jewellery sold on this site is artificial (imitation) bridal jewellery — it is not made of precious metals or genuine gemstones unless explicitly stated on the product page. Product images may include gradient placeholders where a product photograph is not yet available; we do not sell on unrepresentative imagery and add real photography as it is captured.",
    ],
  },
  {
    heading: "Pricing and availability",
    paragraphs: [
      "All prices are listed in Indian Rupees (₹) and are inclusive of applicable taxes unless stated otherwise. We reserve the right to correct pricing errors and to change prices at any time before an order is placed. Placing an order does not guarantee availability; if an item becomes unavailable after you order it, we will contact you to cancel or substitute the item.",
    ],
  },
  {
    heading: "Orders and acceptance",
    paragraphs: [
      "Your order is an offer to buy. We may accept, decline, or cancel any order at our discretion — for example if an item is out of stock, if we suspect fraud, or if the delivery address is outside our serviceable pincodes. You will be notified if an order cannot be fulfilled.",
    ],
  },
  {
    heading: "Payment",
    paragraphs: [
      "Cash on Delivery (COD) is currently the only payment method available. Please keep the order amount ready in cash (or as otherwise instructed at delivery) when your order arrives.",
    ],
  },
  {
    heading: "Shipping, cancellation, and refunds",
    paragraphs: [
      "Delivery timelines and rates are set out on our Shipping & Returns page. Cancellation, return, and refund terms are set out in full in our Cancellation & Refund Policy — please read both before ordering.",
    ],
  },
  {
    heading: "Account registration",
    paragraphs: [
      "You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us immediately if you suspect unauthorised use.",
    ],
  },
  {
    heading: "Intellectual property",
    paragraphs: [
      "All content on this site — including product photography, designs, logos, and text — belongs to RJ Jewellers and may not be reproduced without our written permission.",
    ],
  },
  {
    heading: "Limitation of liability",
    paragraphs: [
      "To the fullest extent permitted by law, RJ Jewellers is not liable for indirect or consequential losses arising from your use of the site or a delayed/damaged delivery beyond our reasonable control (e.g. courier delays). This does not limit any right you have under Indian consumer-protection law.",
    ],
  },
  {
    heading: "Governing law",
    paragraphs: [
      "These terms are governed by the laws of India. Any dispute arising from these terms or your order will be subject to the exclusive jurisdiction of the courts of Jaipur, Rajasthan.",
    ],
  },
  {
    heading: "Changes to these terms",
    paragraphs: [
      'We may revise these terms from time to time; the "last updated" date above reflects the latest revision. Continued use of the site means you accept the current terms.',
    ],
  },
]

export const REFUND_SECTIONS: LegalSectionData[] = [
  {
    heading: "Order cancellation",
    paragraphs: [
      "You can cancel an order any time before it has been dispatched by messaging us on WhatsApp or emailing us with your order number — we'll confirm the cancellation and no charge applies. Once an order has shipped, it can no longer be cancelled and falls under the return process below instead.",
    ],
  },
  {
    heading: "Returns and exchanges",
    paragraphs: ["You have 7 days from the date of delivery to request a return or exchange."],
    list: {
      items: [
        "Eligible: unworn items with tags intact and original packaging/pouch included; wrong, damaged, or defective items; size or plating-tone exchange requests.",
        "Not eligible: items that have been worn or show signs of use; nose pins and ear studs (for hygiene reasons); customised or made-to-order pieces; requests made after 7 days.",
      ],
    },
  },
  {
    heading: "How to request a return",
    paragraphs: [
      "Message us on WhatsApp or email us with your order number within 7 days of delivery. If the return is approved, repack the item unworn with its tags and original pouch, and we'll arrange a reverse pickup on eligible pincodes (or share a self-ship address where pickup isn't available).",
    ],
  },
  {
    heading: "Refunds",
    paragraphs: [
      "Once the returned item passes a quality check, we issue a refund within 5–7 working days. Because we do not collect online payments (Cash on Delivery only), refunds for COD orders are made via bank transfer or UPI to the details you provide — we will contact you to collect these once your return is approved.",
    ],
  },
  {
    heading: "Damaged or defective items",
    paragraphs: [
      "If an item arrives damaged or defective, contact us within 48 hours of delivery with photos of the item and packaging. We will arrange a free replacement or a full refund — your choice — with no return-shipping cost to you.",
    ],
  },
  {
    heading: "Questions about a return",
    paragraphs: [
      "Reach our support team via the contact details below — we're happy to help with any order.",
    ],
  },
]

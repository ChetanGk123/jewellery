/**
 * Static copy for the help / info pages (Shipping, Care, Contact, FAQ, About).
 * Kept in one module so the page components stay presentational. The Shipping,
 * Care, and Contact content mirrors the storefront prototype verbatim; FAQ and
 * About have no prototype equivalent and are authored to match the brand voice.
 *
 * The business's own contact details (phone, email, WhatsApp, address, hours)
 * come from `@/lib/store-info` — the single source of truth — so updating them
 * doesn't mean editing this file too.
 */

import { STORE_INFO } from "@/lib/store-info";

export type IconItem = { icon: string; title: string; body: string };
export type NumberedItem = { n: string; title: string; body: string };
export type RateRow = { label: string; value: string; highlight?: boolean };

export const SHIP_CARDS: IconItem[] = [
  {
    icon: "⏱",
    title: "Dispatch time",
    body: "Orders are carefully packed and dispatched within 2–4 working days.",
  },
  {
    icon: "✈",
    title: "Delivery window",
    body: "Delivered in 4–7 days across India via Shiprocket, with tracking on every order.",
  },
  {
    icon: "₹",
    title: "Cash on Delivery",
    body: "COD available across India on most pincodes — pay when your order arrives.",
  },
  {
    icon: "⚑",
    title: "Order tracking",
    body: "A tracking link is sent by SMS & email the moment your parcel ships.",
  },
];

export const SHIP_RATES: RateRow[] = [
  { label: "Orders of ₹999 and above", value: "FREE", highlight: true },
  { label: "Orders below ₹999", value: "₹79 flat" },
  { label: "Cash on Delivery handling", value: "₹49" },
];

export const RETURN_STEPS: NumberedItem[] = [
  {
    n: "1",
    title: "Request",
    body: "Message us within 7 days of delivery with your order number.",
  },
  {
    n: "2",
    title: "Pack it up",
    body: "Repack the item unworn, with tags and original pouch.",
  },
  {
    n: "3",
    title: "Pickup",
    body: "We arrange a free reverse pickup on eligible pincodes.",
  },
  {
    n: "4",
    title: "Refund",
    body: "Refund issued within 5–7 working days of the quality check.",
  },
];

export const RETURN_YES: string[] = [
  "Unworn items with tags intact",
  "Original packaging & pouch included",
  "Wrong, damaged or defective item received",
  "Size or plating-tone exchange requests",
];

export const RETURN_NO: string[] = [
  "Items worn or showing signs of use",
  "Nose pins & ear studs (hygiene reasons)",
  "Customised or made-to-order pieces",
  "Returns requested after 7 days",
];

export const CARE_RULES: NumberedItem[] = [
  {
    n: "01",
    title: "Last on, first off",
    body: "Put jewellery on after makeup, perfume and hair spray — and take it off first.",
  },
  {
    n: "02",
    title: "Keep it dry",
    body: "Avoid water, sweat and humidity. Never wear it while bathing or swimming.",
  },
  {
    n: "03",
    title: "Store separately",
    body: "Keep each piece in its own pouch so stones and plating don’t scratch.",
  },
  {
    n: "04",
    title: "Wipe after wear",
    body: "Gently buff with a soft, dry cloth before storing to lift oils and moisture.",
  },
];

export const CARE_DO: string[] = [
  "Store in the pouch or a zip-lock pouch with anti-tarnish strips",
  "Wipe with a soft dry cloth after each wear",
  "Keep away from direct sunlight and heat",
  "Handle stones gently from the metal frame",
];

export const CARE_DONT: string[] = [
  "Don’t spray perfume or deodorant onto the jewellery",
  "Don’t use water, soap or chemical cleaners",
  "Don’t wear during workouts, swimming or sleep",
  "Don’t store loose with other pieces in one box",
];

export const CARE_HOW: IconItem[] = [
  {
    icon: "✨",
    title: "Cleaning",
    body: "For everyday shine, buff gently with a dry microfibre or soft cotton cloth. Never soak artificial jewellery or use liquid cleaners — they strip the plating. For stones, use a soft dry brush to lift dust from the settings.",
  },
  {
    icon: "▤",
    title: "Storage",
    body: "Store each piece flat in its individual pouch, away from humidity. Tuck a silica or anti-tarnish strip into your jewellery box, and keep it in a cool, dry drawer rather than a bathroom shelf.",
  },
];

export type ContactChannel = {
  icon: string;
  label: string;
  value: string;
  note: string;
  href?: string;
};

export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    icon: "☎",
    label: "Call us",
    value: STORE_INFO.phone.display,
    note: STORE_INFO.hours.short,
    href: STORE_INFO.phone.href,
  },
  {
    icon: "✉",
    label: "Email",
    value: STORE_INFO.email.display,
    note: "Replies within a few hours",
    href: STORE_INFO.email.href,
  },
  {
    icon: "◈",
    label: "WhatsApp",
    value: "Chat with us",
    note: "Fastest way to reach support",
    href: STORE_INFO.whatsapp.href,
  },
  {
    icon: "⌂",
    label: "Visit our studio",
    value: STORE_INFO.address.line,
    note: STORE_INFO.address.note,
  },
];

export const SUPPORT_HOURS = {
  title: "Support hours",
  line: STORE_INFO.hours.long,
  note: STORE_INFO.hours.note,
};

export type FaqItem = { q: string; a: string };

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Is this real gold or diamond jewellery?",
    a: "No — every piece is artificial (imitation) bridal jewellery with an anti-tarnish gold-tone plating and Kundan, Polki, pearl or CZ stones. It gives the look of heritage bridal gold at a fraction of the cost.",
  },
  {
    q: "How long does delivery take?",
    a: "Orders are dispatched within 2–4 working days and delivered in 4–7 days across India via Shiprocket, with tracking on every order.",
  },
  {
    q: "Do you offer Cash on Delivery?",
    a: "Yes. COD is available across India on most pincodes — you pay when your order arrives. A small ₹49 handling fee applies to COD orders.",
  },
  {
    q: "Can I return or exchange an item?",
    a: "You have 7 days from delivery to request a return or exchange on unworn items in their original packaging with tags intact. Nose pins, ear studs and made-to-order pieces are not returnable for hygiene reasons.",
  },
  {
    q: "Will the plating tarnish over time?",
    a: "Every JR piece carries an anti-tarnish plating. Kept dry, wiped after wear and stored in its pouch, your jewellery will stay radiant through every celebration — see our Care Guide.",
  },
  {
    q: "Do you make custom or made-to-order bridal sets?",
    a: "Yes — message us on WhatsApp with your requirement and event date, and our team will help you plan a custom bridal set.",
  },
];

export const ABOUT_INTRO =
  "RJ Jewellers began with a simple belief — that every bride deserves to feel like royalty, without the weight of a gold budget. From our studio in Jaipur, we craft artificial bridal jewellery that carries the soul of traditional Kundan, Polki and temple work, reimagined for the modern celebration.";

export const ABOUT_VALUES: IconItem[] = [
  {
    icon: "✦",
    title: "Heritage craft",
    body: "Every design is rooted in classical Rajasthani bridal artistry — Kundan settings, Polki cuts and temple motifs, made by hand.",
  },
  {
    icon: "♦",
    title: "Honest value",
    body: "Anti-tarnish plating and quality stones at a fraction of real-gold prices, so you can wear heirloom looks without the heirloom cost.",
  },
  {
    icon: "❤",
    title: "Made for brides",
    body: "From mandap sets to everyday jhumkas, each piece is designed to photograph beautifully and feel light through long celebrations.",
  },
];

/**
 * Shared contact-form validation (TASKS 3.8) — used by BOTH the storefront
 * ContactForm and the `submitContactMessage` server action so the two can't
 * drift. Pure zod, no React / server-only deps. `contact` is a single freeform
 * field (email or phone, as the customer typed it); `subject` is optional. The
 * `submit_contact_message` RPC re-checks the required fields at the write
 * boundary since it's anon-callable.
 */

import { z } from "zod";

export const contactMessageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(80, "Name is too long."),
  contact: z
    .string()
    .trim()
    .min(3, "Enter your email or phone.")
    .max(120, "That's too long."),
  subject: z.string().trim().max(120, "Subject is too long.").optional(),
  message: z
    .string()
    .trim()
    .min(5, "Please add a little more detail.")
    .max(2000, "Message is too long."),
});

export type ContactMessageValues = z.infer<typeof contactMessageSchema>;

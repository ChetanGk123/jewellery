"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitContactMessage } from "@/app/(storefront)/contact/actions";
import { Honeypot } from "@/components/ui/Honeypot";

const inputClass =
  "w-full rounded-sm border border-[#E7D9C2] bg-cream-50 px-3.5 py-3 text-[14px] text-maroon-900 outline-none transition-colors focus-visible:border-gold-400 placeholder:text-[#B79B7E]";

type ContactField = "name" | "email" | "phone" | "subject" | "message";

/**
 * Contact form (TASKS 3.8) — submits through the `submitContactMessage` server
 * action, which stores the enquiry as a ticket and returns its number. A hidden
 * honeypot drops naive bots (enforced server-side, like checkout). On success it
 * shows the prototype's gold-check confirmation with the ticket reference; field
 * and form errors surface inline. Mirrors the storefront prototype's layout
 * (name + contact row, subject, message).
 */
export function ContactForm() {
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [honeypot, setHoneypot] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<ContactField, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [ticketNo, setTicketNo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setField = (field: ContactField, value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await submitContactMessage({ values, honeypot });
      if (res.ok) {
        setTicketNo(res.ticketNo);
      } else {
        setFieldErrors(res.fieldErrors);
        setFormError(res.formError ?? "Something went wrong. Please try again.");
      }
    });
  }

  function reset() {
    setValues({ name: "", email: "", phone: "", subject: "", message: "" });
    setHoneypot("");
    setFieldErrors({});
    setFormError(null);
    setTicketNo(null);
  }

  if (ticketNo) {
    return (
      <div className="flex flex-col items-center gap-3.5 rounded-md border border-[#E7D9C2] bg-cream-50 px-6 py-[30px] text-center">
        <span
          className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] text-[34px] text-[#3A0E18]"
          aria-hidden
        >
          ✓
        </span>
        <h3 className="m-0 font-heading text-[26px] font-semibold leading-[1.1] text-maroon-900">
          Message sent!
        </h3>
        <p className="m-0 max-w-[360px] text-[14px] font-light leading-[1.6] text-[#5E4A44]">
          Thanks for reaching out. Your reference is{" "}
          <span className="font-semibold text-maroon-700">{ticketNo}</span> — our
          team will reply to you shortly.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-1.5 rounded-sm bg-maroon-700 px-[26px] py-3 text-[12px] font-semibold uppercase leading-none tracking-[0.12em] text-cream-200 transition-colors hover:bg-maroon-800"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#E7D9C2] bg-cream-50 p-[30px]">
      <div className="mb-3.5 text-[13px] font-semibold uppercase leading-none tracking-[0.14em] text-maroon-900">
        Send a message
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Honeypot value={honeypot} onChange={setHoneypot} />

        {formError && (
          <p className="rounded-sm border border-[#E7B9B0] bg-[#FBECE9] px-3.5 py-2.5 text-[13px] leading-snug text-[#B23A2C]">
            {formError}
          </p>
        )}

        <div className="flex flex-wrap gap-3.5">
          <div className="flex min-w-[160px] flex-1 flex-col">
            <label htmlFor="contact-name" className="sr-only">
              Your name
            </label>
            <input
              id="contact-name"
              name="name"
              required
              value={values.name}
              onChange={(event) => setField("name", event.target.value)}
              placeholder="Your name"
              aria-invalid={fieldErrors.name ? true : undefined}
              className={inputClass}
            />
            {fieldErrors.name && <FieldError>{fieldErrors.name}</FieldError>}
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col">
            <label htmlFor="contact-email" className="sr-only">
              Email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
              placeholder="Email"
              aria-invalid={fieldErrors.email ? true : undefined}
              className={inputClass}
            />
            {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
          </div>
        </div>
        <div className="flex flex-col">
          <label htmlFor="contact-phone" className="sr-only">
            Phone
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            required
            value={values.phone}
            onChange={(event) => setField("phone", event.target.value)}
            placeholder="Phone (10-digit mobile)"
            aria-invalid={fieldErrors.phone ? true : undefined}
            className={inputClass}
          />
          {fieldErrors.phone && <FieldError>{fieldErrors.phone}</FieldError>}
        </div>
        <label htmlFor="contact-subject" className="sr-only">
          Subject
        </label>
        <input
          id="contact-subject"
          name="subject"
          value={values.subject}
          onChange={(event) => setField("subject", event.target.value)}
          placeholder="Subject (order no., product, etc.)"
          className={inputClass}
        />
        <label htmlFor="contact-message" className="sr-only">
          How can we help?
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          value={values.message}
          onChange={(event) => setField("message", event.target.value)}
          placeholder="How can we help?"
          aria-invalid={fieldErrors.message ? true : undefined}
          className={`${inputClass} resize-y`}
        />
        {fieldErrors.message && <FieldError>{fieldErrors.message}</FieldError>}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-sm bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-8 py-4 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#3A0E18] shadow-[0_10px_24px_rgba(168,122,30,0.28)] transition-[filter] hover:brightness-105 disabled:opacity-70"
        >
          {isPending ? "Sending…" : "Send message"}
        </button>
      </form>
    </div>
  );
}

function FieldError({ children }: { children: string }) {
  return (
    <span className="mt-1 text-[12px] leading-snug text-[#B23A2C]">
      {children}
    </span>
  );
}

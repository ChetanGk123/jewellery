"use client";

import { useState, type FormEvent } from "react";

const inputClass =
  "w-full rounded-sm border border-[#E7D9C2] bg-cream-50 px-3.5 py-3 text-[14px] text-maroon-900 outline-none transition-colors focus-visible:border-gold-400 placeholder:text-[#B79B7E]";

/**
 * Contact form — UI only for v1 (no submission endpoint yet). On submit it
 * shows an inline confirmation with the sender's name; wiring to a real handler
 * is a later phase. Mirrors the storefront prototype's contact form + sent
 * state (name + contact row, subject, message; gold success check).
 */
export function ContactForm() {
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  if (sent) {
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
        <p className="m-0 max-w-[340px] text-[14px] font-light leading-[1.6] text-[#5E4A44]">
          Thanks for reaching out{name ? `, ${name}` : ""}. Our team will reply
          to you shortly.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
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
        <div className="flex flex-wrap gap-3.5">
          <div className="flex min-w-[160px] flex-1 flex-col">
            <label htmlFor="contact-name" className="sr-only">
              Your name
            </label>
            <input
              id="contact-name"
              name="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
          </div>
          <div className="flex min-w-[160px] flex-1 flex-col">
            <label htmlFor="contact-detail" className="sr-only">
              Email or phone
            </label>
            <input
              id="contact-detail"
              name="contact"
              type="text"
              required
              placeholder="Email or phone"
              className={inputClass}
            />
          </div>
        </div>
        <label htmlFor="contact-subject" className="sr-only">
          Subject
        </label>
        <input
          id="contact-subject"
          name="subject"
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
          placeholder="How can we help?"
          className={`${inputClass} resize-y`}
        />
        <button
          type="submit"
          className="rounded-sm bg-[linear-gradient(135deg,#E6CA7E,#C9A24B_55%,#A87A1E)] px-8 py-4 text-[12px] font-semibold uppercase leading-none tracking-[0.14em] text-[#3A0E18] shadow-[0_10px_24px_rgba(168,122,30,0.28)] transition-[filter] hover:brightness-105"
        >
          Send message
        </button>
      </form>
    </div>
  );
}

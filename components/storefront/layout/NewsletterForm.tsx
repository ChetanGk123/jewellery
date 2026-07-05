"use client";

import { useState, useTransition } from "react";
import { Honeypot } from "@/components/ui/Honeypot";
import { subscribe } from "./subscribe-action";

/**
 * Footer "Stay in touch" sign-up (TASKS 3.9). Preserves the prototype's
 * gold-bordered input + Join button, and now actually saves through the
 * `subscribe` server action (shared `subscribeSchema`, honeypot, rate-limited).
 * On success the form is replaced by a gold confirmation; errors surface inline.
 * The address de-dupes server-side, so a repeat sign-up still reads as success.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await subscribe({ values: { email }, honeypot });
      if (res.ok) {
        setDone(
          res.alreadyMember
            ? "You're already on the list — thank you!"
            : "You're on the list. Watch your inbox.",
        );
        setEmail("");
      } else {
        setError(res.error);
      }
    });
  };

  if (done) {
    return (
      <p className="m-0 flex items-center gap-2 text-[13px] font-light leading-[1.5] text-gold-300">
        <span aria-hidden="true">✓</span>
        {done}
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-2"
      aria-label="Newsletter sign-up"
    >
      <div className="flex overflow-hidden rounded-sm border border-gold-300/40 focus-within:border-gold-300">
        <Honeypot value={honeypot} onChange={setHoneypot} />
        <input
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-label="Email address"
          aria-invalid={error ? true : undefined}
          placeholder="Your email"
          className="min-w-0 flex-1 border-none bg-transparent px-3 py-[11px] text-xs text-gold-300 outline-none placeholder:text-gold-300/60"
        />
        <button
          type="submit"
          disabled={isPending}
          className="cursor-pointer border-none bg-gold-300 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-maroon-950 transition-colors hover:bg-gold-400 disabled:opacity-60"
        >
          {isPending ? "…" : "Join"}
        </button>
      </div>
      {error && (
        <span role="alert" className="text-[11.5px] font-light text-[#E7A9A0]">
          {error}
        </span>
      )}
    </form>
  );
}

import type { Metadata } from "next";
import { HelpHeader } from "@/components/storefront/help/HelpHeader";
import { ContactForm } from "@/components/storefront/help/ContactForm";
import {
  CONTACT_CHANNELS,
  SUPPORT_HOURS,
  type ContactChannel,
} from "@/lib/help-content";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Questions about an order, sizing, or a custom bridal set? Call, email, or WhatsApp JR Jewellers — we usually reply within a few hours.",
};

const channelCardClass =
  "flex items-center gap-4 rounded-md border border-[#E7D9C2] bg-cream-50 p-[18px_20px] transition-colors hover:border-gold-400";

function ChannelBody({ channel }: { channel: ContactChannel }) {
  return (
    <>
      <span
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#F3E9DA] text-[19px] text-maroon-700"
        aria-hidden
      >
        {channel.icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[12px] font-semibold uppercase leading-none tracking-[0.08em] text-gold-600">
          {channel.label}
        </span>
        <span className="text-[15px] leading-[1.3] text-maroon-900">
          {channel.value}
        </span>
        <span className="text-[12px] font-light leading-[1.3] text-[#7A655F]">
          {channel.note}
        </span>
      </span>
    </>
  );
}

/**
 * Contact Us (TASKS 1.7) — prototype-matched: a column of contact-channel cards
 * (tel / mailto / WhatsApp links) plus support hours, beside the UI-only
 * contact form.
 */
export default function ContactPage() {
  return (
    <main>
      <HelpHeader
        crumb="Contact Us"
        eyebrow="We're here to help"
        title="Contact Us"
        intro="Questions about an order, sizing or a custom bridal set? Reach out — we usually reply within a few hours."
      />

      <div className="mx-auto flex max-w-[1080px] flex-col items-start gap-10 px-6 pb-[70px] pt-[54px] md:flex-row md:flex-wrap">
        <div className="flex w-full flex-col gap-4 md:w-auto md:min-w-0 md:flex-1">
          <h2 className="m-0 mb-1 font-heading text-[26px] font-semibold leading-[1.1] text-maroon-900">
            Get in touch
          </h2>
          {CONTACT_CHANNELS.map((channel) =>
            channel.href ? (
              <a
                key={channel.label}
                href={channel.href}
                target={channel.href.startsWith("http") ? "_blank" : undefined}
                rel={
                  channel.href.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined
                }
                className={channelCardClass}
              >
                <ChannelBody channel={channel} />
              </a>
            ) : (
              <div key={channel.label} className={channelCardClass}>
                <ChannelBody channel={channel} />
              </div>
            ),
          )}
          <div className="flex flex-col gap-1.5 rounded-md border border-[#E7D9C2] bg-cream-50 p-5">
            <span className="text-[12px] font-semibold uppercase leading-none tracking-[0.08em] text-gold-600">
              {SUPPORT_HOURS.title}
            </span>
            <span className="text-[14px] leading-[1.6] text-maroon-900">
              {SUPPORT_HOURS.line}
            </span>
            <span className="text-[12.5px] font-light leading-[1.5] text-[#7A655F]">
              {SUPPORT_HOURS.note}
            </span>
          </div>
        </div>

        <div className="w-full md:min-w-0 md:flex-[1.2]">
          <ContactForm />
        </div>
      </div>
    </main>
  );
}

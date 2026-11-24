import type { Metadata } from "next";
import { ContactForm } from "@/components/marketing/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us | Pixa, by Framewrk",
  description: "Get in touch with the Pixa team for support, billing, or feedback.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#3478F6]">Contact Us</p>
      <h1 className="mt-3 font-syne text-3xl font-bold text-[#111418] dark:text-white sm:text-4xl">
        We&apos;re here to help
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#5c6470] dark:text-neutral-400">
        Questions about a presentation, credits, or your account? Send us a note and the
        team will get back to you. For fastest help with a specific deck, include the
        account email you signed up with.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <ContactForm />

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#e5e7eb] p-5 dark:border-neutral-800">
            <h2 className="font-syne text-sm font-semibold text-[#111418] dark:text-white">
              Support
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
              Account access, generation errors, exports, and provider configuration.
            </p>
          </section>
          <section className="rounded-2xl border border-[#e5e7eb] p-5 dark:border-neutral-800">
            <h2 className="font-syne text-sm font-semibold text-[#111418] dark:text-white">
              Billing
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
              The ₹19 unlock is a one-time payment per presentation download, not a
              subscription. See the{" "}
              <a className="font-medium text-[#3478F6]" href="/terms#refunds">
                refund policy
              </a>
              .
            </p>
          </section>
          <section className="rounded-2xl border border-[#e5e7eb] p-5 dark:border-neutral-800">
            <h2 className="font-syne text-sm font-semibold text-[#111418] dark:text-white">
              Privacy
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
              Details on what we store and how uploaded documents are handled are in our{" "}
              <a className="font-medium text-[#3478F6]" href="/privacy">
                Privacy Policy
              </a>
              .
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { notify } from "@/components/ui/sonner";

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@presenton.ai";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !message.trim()) {
      notify.warning("Missing details", "Add your email and a short message so we can reply.");
      return;
    }

    const subject = encodeURIComponent(`Pixa support request from ${name.trim() || email.trim()}`);
    const body = encodeURIComponent(
      `From: ${name.trim() || "(no name given)"}\nEmail: ${email.trim()}\n\n${message.trim()}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-[#111418] dark:text-white">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className="mt-1.5 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 py-2.5 text-sm font-normal text-[#111418] outline-none transition focus:border-[#3478F6] focus:ring-2 focus:ring-[#3478F6]/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            placeholder="Your name"
          />
        </label>
        <label className="block text-xs font-semibold text-[#111418] dark:text-white">
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            autoComplete="email"
            className="mt-1.5 w-full rounded-xl border border-[#e5e7eb] bg-white px-3.5 py-2.5 text-sm font-normal text-[#111418] outline-none transition focus:border-[#3478F6] focus:ring-2 focus:ring-[#3478F6]/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            placeholder="you@company.com"
          />
        </label>
      </div>
      <label className="block text-xs font-semibold text-[#111418] dark:text-white">
        How can we help?
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          rows={6}
          className="mt-1.5 w-full resize-y rounded-xl border border-[#e5e7eb] bg-white px-3.5 py-2.5 text-sm font-normal text-[#111418] outline-none transition focus:border-[#3478F6] focus:ring-2 focus:ring-[#3478F6]/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
          placeholder="Describe your question, billing issue, or feedback."
        />
      </label>
      <button
        type="submit"
        className="rounded-xl bg-[#3478F6] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6]"
      >
        Send message
      </button>
      <p className="text-xs text-[#7b8494] dark:text-neutral-400">
        This opens your email app with the message pre-filled and addressed to{" "}
        <a className="font-medium text-[#3478F6]" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </form>
  );
}

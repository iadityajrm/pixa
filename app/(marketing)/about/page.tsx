import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us | Pixa, by Framewrk",
  description:
    "Pixa turns prompts and documents into polished presentations. Learn who we build for and how the product works.",
};

const values = [
  {
    title: "From idea to deck in minutes",
    body: "Describe your topic or upload a document and Pixa drafts a structured outline, writes the content, and designs every slide in the language you choose.",
  },
  {
    title: "Design that stays consistent",
    body: "Built-in templates and layout rules keep typography, spacing, and visuals consistent across the whole deck, so nothing looks hand-assembled.",
  },
  {
    title: "Yours to take anywhere",
    body: "Export to PowerPoint or PDF, present straight from the browser, and keep editing in the tools you already use.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#3478F6]">About Us</p>
      <h1 className="mt-3 font-syne text-3xl font-bold text-[#111418] dark:text-white sm:text-4xl">
        Presentations without the busywork
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#5c6470] dark:text-neutral-400">
        Pixa is an AI presentation generator built by Framewrk. It exists for the
        moments when the story matters more than the slide design: a pitch, a class, a
        report, a last-minute review. Give it a prompt or a document and it produces a
        complete, editable deck you can present or download.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {values.map((value) => (
          <section
            key={value.title}
            className="rounded-2xl border border-[#e5e7eb] bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <h2 className="font-syne text-base font-semibold text-[#111418] dark:text-white">
              {value.title}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
              {value.body}
            </p>
          </section>
        ))}
      </div>

      <section className="mt-12 rounded-2xl bg-[#F6F4FF] p-6 dark:bg-neutral-900">
        <h2 className="font-syne text-lg font-semibold text-[#111418] dark:text-white">
          Bring your own AI provider
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5c6470] dark:text-neutral-400">
          Teams can connect the text and image providers they already pay for, or use the
          providers configured by their administrator. Your content stays within the
          provider you choose, and access is managed per account.
        </p>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/upload"
          className="rounded-xl bg-[#3478F6] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2563EB]"
        >
          Create a presentation
        </Link>
        <Link
          href="/contact"
          className="rounded-xl border border-[#e5e7eb] px-5 py-2.5 text-sm font-semibold text-[#111418] transition hover:bg-[#F6F7F9] dark:border-neutral-700 dark:text-white dark:hover:bg-neutral-800"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
}

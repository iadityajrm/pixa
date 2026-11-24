"use client";

import React, { useState } from "react";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { ScrollReveal } from "./ScrollReveal";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LandingSectionsProps {
  onStartClick?: () => void;
  onSelectTopic?: (topic: string, slides?: number) => void;
}

export default function LandingSections({
  onStartClick,
  onSelectTopic,
}: LandingSectionsProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  };

  return (
    <div className="w-full bg-[#fbfbfb]/80 dark:bg-zinc-950/80 text-[#111418] dark:text-[#f3f4f6] font-sans">
      {/* SECTION: HOW IT WORKS */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6" id="how-it-works">
        <ScrollReveal>
          <div className="text-center">
            <span className="inline-block rounded-full bg-[#e5f1f8] px-3.5 py-1 text-xs font-semibold tracking-wider text-[#2c5270] uppercase">
              How It Works
            </span>
            <h2 className="mt-3 font-serif text-3xl font-medium tracking-tight text-[#111418] dark:text-white sm:text-4xl">
              From an idea to a presentation in minutes.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#5c6470] dark:text-neutral-400 sm:text-base">
              Stop spending hours building slides from scratch. Tell us what your presentation is about, and let AI help you create a structured, editable slide deck.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <ScrollReveal delayMs={60}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111418] dark:bg-white text-xs font-bold text-white dark:text-[#111418]">
                    1
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                    </svg>
                  </div>
                </div>
                <h3 className="mt-4 font-semibold text-[#111418] dark:text-white">Enter your topic</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                  Tell us what you need to present. Add instructions, choose length, and let AI get started.
                </p>
              </div>
              <div className="mt-4 rounded-lg bg-[#f8f9fa] dark:bg-neutral-800/60 px-2.5 py-1 text-[11px] font-medium text-[#7b8494] dark:text-neutral-400">
                Topic • Length • Instructions
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={120}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111418] dark:bg-white text-xs font-bold text-white dark:text-[#111418]">
                    2
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                </div>
                <h3 className="mt-4 font-semibold text-[#111418] dark:text-white">Generate your slides</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                  Get a complete presentation with organized content, visual layouts, and relevant imagery.
                </p>
              </div>
              <div className="mt-4 rounded-lg bg-[#f8f9fa] dark:bg-neutral-800/60 px-2.5 py-1 text-[11px] font-medium text-[#7b8494] dark:text-neutral-400">
                Auto Structure • Flow
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={180}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111418] dark:bg-white text-xs font-bold text-white dark:text-[#111418]">
                    3
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </div>
                </div>
                <h3 className="mt-4 font-semibold text-[#111418] dark:text-white">Edit it your way</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                  Refine the content, change layouts, and make corrections until you’re happy with the result.
                </p>
              </div>
              <div className="mt-4 rounded-lg bg-[#f8f9fa] dark:bg-neutral-800/60 px-2.5 py-1 text-[11px] font-medium text-[#7b8494] dark:text-neutral-400">
                WYSIWYG • Layout Swap
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={240}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111418] dark:bg-white text-xs font-bold text-white dark:text-[#111418]">
                    4
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                </div>
                <h3 className="mt-4 font-semibold text-[#111418] dark:text-white">Present or download</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                  Present directly from your browser. Download your finished deck as PowerPoint (PPTX) or PDF.
                </p>
              </div>
              <div className="mt-4 rounded-lg bg-[#f8f9fa] dark:bg-neutral-800/60 px-2.5 py-1 text-[11px] font-medium text-[#7b8494] dark:text-neutral-400">
                Online Stage • PPTX • PDF
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* SECTION: FEATURES */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6" id="features">
        <ScrollReveal>
          <div className="text-center">
            <span className="inline-block rounded-full bg-[#e5f1f8] px-3.5 py-1 text-xs font-semibold tracking-wider text-[#2c5270] uppercase">
              Feature Suite
            </span>
            <h2 className="mt-3 font-serif text-3xl font-medium tracking-tight text-[#111418] dark:text-white sm:text-4xl">
              Everything you need to build better presentations.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#5c6470] dark:text-neutral-400">
              Designed thoughtfully to eliminate friction from concept to final export.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <ScrollReveal delayMs={60}>
            <div className="h-full rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#3478F6]/10 text-[#3478F6]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[#111418] dark:text-white">AI-powered generation</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                Turn a topic into a structured slide deck with intuitive narrative progression.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={120}>
            <div className="h-full rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#3478F6]/10 text-[#3478F6]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[#111418] dark:text-white">Editable slides</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                Make changes to individual slides instead of starting over. Tweak text, reorder, or replace items in seconds.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={180}>
            <div className="h-full rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#3478F6]/10 text-[#3478F6]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[#111418] dark:text-white">Ready-to-present layouts</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                Keep your slides organized, readable, and visually consistent with harmonious typography and spacing.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={60}>
            <div className="h-full rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#3478F6]/10 text-[#3478F6]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[#111418] dark:text-white">Relevant visuals</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                Make your ideas easier to understand with curated images, diagrams, and visual accent elements.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={120}>
            <div className="h-full rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#3478F6]/10 text-[#3478F6]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[#111418] dark:text-white">Browser-based presenting</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                Preview and present your work directly in your browser with speaker controls without downloading it first.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={180}>
            <div className="h-full rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xs">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#3478F6]/10 text-[#3478F6]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[#111418] dark:text-white">PPTX and PDF exports</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                Get your presentation in standard formats you can submit to college portals, share, and present offline.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* SECTION: PRICING */}
      <section className="border-t border-[#e5e7eb] dark:border-neutral-800 bg-[#f4f4f6]/50 dark:bg-neutral-900/30 py-16" id="pricing">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <ScrollReveal>
            <div className="text-center">
              <span className="inline-block rounded-full bg-[#e5f1f8] px-3.5 py-1 text-xs font-semibold tracking-wider text-[#2c5270] uppercase">
                Simple, Transparent Pricing
              </span>
              <h2 className="mt-3 font-serif text-3xl font-medium tracking-tight text-[#111418] dark:text-white sm:text-4xl">
                Start free. Unlock downloads when you’re ready.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#5c6470] dark:text-neutral-400">
                No monthly subscriptions. No payment just to try it.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
            {/* Free Tier */}
            <ScrollReveal delayMs={60}>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 sm:p-8 shadow-xs">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#7b8494]">Free Tier</span>
                  <h3 className="mt-1 text-2xl font-bold font-serif text-[#111418] dark:text-white">Free</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-bold">₹</span>
                    <span className="text-4xl font-extrabold text-[#111418] dark:text-white">0</span>
                    <span className="text-xs text-[#7b8494]">/ forever</span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                    Perfect for creating, polishing, and practicing your talk online.
                  </p>

                  <ul className="mt-6 space-y-2.5 text-xs text-[#5c6470] dark:text-neutral-300">
                    <li className="flex items-center gap-2">
                      <svg className="text-emerald-500 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>Create your first AI presentation.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="text-emerald-500 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>Edit and customize your slides.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="text-emerald-500 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>Revisit and present online.</span>
                    </li>
                    <li className="flex items-center gap-2 text-neutral-400 dark:text-neutral-600 line-through">
                      <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      <span>Downloadable exports.</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={onStartClick}
                  className="mt-8 w-full rounded-xl border border-[#111418] dark:border-white py-2.5 text-xs font-semibold text-[#111418] dark:text-white transition hover:bg-[#111418] hover:text-white dark:hover:bg-white dark:hover:text-[#111418]"
                >
                  Create Your Free Presentation
                </button>
              </div>
            </ScrollReveal>

            {/* Paid Unlock Plan */}
            <ScrollReveal delayMs={120}>
              <div className="relative flex h-full flex-col justify-between rounded-2xl border-2 border-[#3478F6] bg-white dark:bg-neutral-900 p-6 sm:p-8 shadow-md">
                <span className="absolute -top-3 right-6 rounded-full bg-[#3478F6] px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Most Popular • Pay Once
                </span>

                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#3478F6]">Download Unlock</span>
                  <h3 className="mt-1 text-2xl font-bold font-serif text-[#111418] dark:text-white">One-time unlock</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-[#3478F6]">₹</span>
                    <span className="text-4xl font-extrabold text-[#111418] dark:text-white">19</span>
                    <span className="text-xs text-[#7b8494]">/ single payment</span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400">
                    One payment. No monthly recurring commitment.
                  </p>

                  <ul className="mt-6 space-y-2.5 text-xs text-[#5c6470] dark:text-neutral-300">
                    <li className="flex items-center gap-2">
                      <svg className="text-emerald-500 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>Unlock downloads for your presentations.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="text-emerald-500 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>Export to PowerPoint and PDF.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="text-emerald-500 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>Get 5 additional AI presentation credits.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="text-emerald-500 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>Keep access without recurring subscriptions.</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={onStartClick}
                  className="mt-8 w-full rounded-xl bg-[#3478F6] py-2.5 text-xs font-semibold text-white transition hover:bg-[#2563EB] shadow-xs"
                >
                  Unlock Downloads — ₹19
                </button>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* SECTION: FAQ */}
      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6" id="faq">
        <ScrollReveal>
          <div className="text-center">
            <span className="inline-block rounded-full bg-[#e5f1f8] px-3.5 py-1 text-xs font-semibold tracking-wider text-[#2c5270] uppercase">
              Got Questions?
            </span>
            <h2 className="mt-3 font-serif text-3xl font-medium tracking-tight text-[#111418] dark:text-white sm:text-4xl">
              Frequently asked questions
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#5c6470] dark:text-neutral-400">
              Everything you need to know about creating, editing, and unlocking Pixa.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-10 space-y-3">
          {[
            {
              q: "Is my first presentation really free?",
              a: "Yes. You can generate your first presentation, edit it, revisit it, and present it online without paying.",
            },
            {
              q: "Why do I need to pay to download?",
              a: "The free experience lets you create and refine your presentation first. A one-time payment unlocks downloadable exports and includes additional AI presentation credits.",
            },
            {
              q: "Can I edit my presentation before downloading?",
              a: "Yes. You can make changes and review your slides before deciding to download.",
            },
            {
              q: "What formats can I download?",
              a: "You can export your presentation as PowerPoint (PPTX) or PDF.",
            },
            {
              q: "Is this a subscription?",
              a: "No. The ₹19 unlock is a one-time payment. There are no recurring monthly charges.",
            },
            {
              q: "Can I present without downloading?",
              a: "Yes. You can present directly from the website using your browser.",
            },
            {
              q: "Do I need to pay before creating a presentation?",
              a: "No. Start creating your first presentation for free.",
            },
          ].map((item, index) => {
            const isOpen = openFaq === index;
            return (
              <ScrollReveal key={index} delayMs={index * 40}>
                <div
                  className="overflow-hidden rounded-xl border border-[#e5e7eb] dark:border-neutral-800 bg-white dark:bg-neutral-900 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold text-[#111418] dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478F6]"
                  >
                    <span>{item.q}</span>
                    <span className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center text-neutral-400">
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-300 ease-out",
                          isOpen && "rotate-180"
                        )}
                      />
                    </span>
                  </button>
                  <div
                    className={cn(
                      "grid transition-all duration-300 ease-out",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-[#e5e7eb] dark:border-neutral-800 px-4 py-3 text-xs leading-relaxed text-[#5c6470] dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-950/30">
                        {item.a}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <SiteFooter />
    </div>
  );
}

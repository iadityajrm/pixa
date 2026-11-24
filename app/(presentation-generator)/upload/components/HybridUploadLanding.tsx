"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import UploadPage from "./UploadPage";
import GenerateHeader from "./GenerateHeader";
import LandingSections from "./LandingSections";
import type { PresentationGenerationMode } from "@/utils/presentationGenerationMode";

// The WebGL background and the auth modal are not needed for first paint, so
// keep them out of the landing page's hydration bundle.
const GradientASCII = dynamic(() => import("@/components/ui/GradientASCII"), {
  ssr: false,
});
const AuthModal = dynamic(() => import("@/components/Auth/AuthModal"));

type HybridUploadLandingProps = {
  communityEnabled: boolean;
  presentationGenerationMode: PresentationGenerationMode;
};

export default function HybridUploadLanding({
  communityEnabled,
  presentationGenerationMode,
}: HybridUploadLandingProps) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [selectedTopic, setSelectedTopic] = useState<{
    topic: string;
    slides?: number;
  } | null>(null);

  const scrollToInput = () => {
    const el = document.getElementById("generator-input-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSelectTopic = (topic: string, slides?: number) => {
    setSelectedTopic({ topic, slides });
    scrollToInput();
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-[#F6F6F9] dark:bg-zinc-950 transition-colors overflow-hidden">
      {/* Background GradientASCII Animation */}
      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden opacity-30 dark:opacity-40">
        <GradientASCII
          colors={['#1e3fd8', '#f6f8ff', '#a5d8ff', '#38bdf8']}
          shape="horizon"
          characters=" =+xX0S8#@"
          cellSize={18}
          density={0.8}
        />
      </div>

      <div className="relative z-10 flex min-h-dvh flex-col">
        <GenerateHeader
          onSignInClick={() => {
            setAuthMode("login");
            setAuthModalOpen(true);
          }}
        />

        <main className="flex flex-1 flex-col pb-10 animate-page-stagger">
          {/* Main interactive Hero & Generation section */}
          <section
            id="generator-input-section"
            className="w-full pt-[46px] pb-12 transition-all duration-300"
          >
            {/* Elegant Reference Process Pill */}
            <div className="motion-enter mx-auto mb-4 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e2e5e9] bg-[#e5f1f8] px-3.5 py-1 text-xs font-semibold text-[#2c5270] shadow-2xs dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-[#a5b4fc]">
                <span>Create</span>
                <span className="opacity-40">•</span>
                <span>Edit</span>
                <span className="opacity-40">•</span>
                <span>Present</span>
                <span className="opacity-40">•</span>
                <span>Download</span>
              </div>
            </div>

            <div className="motion-enter mb-7 flex flex-col items-center justify-center gap-2 px-4 text-center">
              <h1 className="font-syne text-[36px] font-bold leading-normal tracking-[-0.58px] text-[#101323] dark:text-white sm:text-[48px] lg:text-[56px] lg:leading-[68px]">
                AI presentations, made simple.
              </h1>
              <p className="max-w-[620px] font-syne text-sm leading-[1.5] tracking-[0.1px] text-[#101323CC] dark:text-neutral-300 sm:text-base">
                Create your presentation. Make your edits. Present it online.
                Download it when you’re ready.
              </p>
            </div>

            {/* Core Upload and prompt section kept intact */}
            <UploadPage
              communityEnabled={communityEnabled}
              presentationGenerationMode={presentationGenerationMode}
              onRequireAuth={() => {
                setAuthMode("signup");
                setAuthModalOpen(true);
              }}
              initialTopic={selectedTopic?.topic}
              initialSlides={selectedTopic?.slides}
            />
          </section>

          {/* Rich Landing Presentation Sections */}
          <div className="motion-fade motion-delay-2 w-full">
            <LandingSections
              onStartClick={scrollToInput}
              onSelectTopic={handleSelectTopic}
            />
          </div>
        </main>

        <AuthModal
          isOpen={authModalOpen}
          onOpenChange={setAuthModalOpen}
          initialMode={authMode}
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { GenerationMode } from "@/utils/presentationGenerationMode";
import { getApiUrl } from "@/utils/api";

const GUIDE_KEY = "presenton_generate_guide_v3";

export default function GenerateUserGuide({ mode, communityEnabled }: { mode: GenerationMode; communityEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [boxPosition, setBoxPosition] = useState<{ top: number; left: number } | null>(null);
  const steps = [
    { target: "setup", title: "Choose how your slides are designed", description: "Smart creates layouts around your content. Standard uses your chosen template. Set the slide count, language, and advanced settings beside the mode switch." },
    { target: "prompt", title: "Write your presentation brief", description: "Describe your topic, audience, and key points. Use the paperclip to attach supporting documents. Choose a language when working with documents." },
    ...(mode === "smart" && communityEnabled ? [{ target: "designs", title: "Choose an optional design reference", description: "Search Community designs, preview them with the eye button, then choose Use. The menu also lets you reuse a prompt. Browse All opens the full community library." }] : []),
    { target: "prompt", title: "Generate your presentation", description: "Select the blue arrow, or press Command/Ctrl + Enter in your brief. Smart opens your generated presentation; Standard starts with an outline and template selection. Press ? on this page to reopen this guide." },
  ];
  const current = steps[Math.min(step, steps.length - 1)];

  useEffect(() => {
    let cancelled = false;
    const checkAuthAndOpen = async () => {
      try {
        const res = await fetch(getApiUrl("/api/v1/auth/status"), {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!data?.authenticated || cancelled) return;
        setIsAuthenticated(true);
        if (localStorage.getItem(GUIDE_KEY) !== "seen") {
          setOpen(true);
        }
      } catch {
        // Keep guide hidden if auth status cannot be verified.
      }
    };
    checkAuthAndOpen();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "?" || target?.closest("input, textarea, [contenteditable=true], [role=dialog]") || document.querySelector("[role=dialog]")) return;
      event.preventDefault();
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open) return;
    const target = document.querySelector<HTMLElement>(`[data-generate-guide="${current.target}"]`);
    if (!target) {
      setBoxPosition(null);
      return;
    }
    const previousOutline = target.style.outline;
    const previousOffset = target.style.outlineOffset;
    target.style.outline = "2px solid #3478F6";
    target.style.outlineOffset = "6px";
    target.scrollIntoView({ behavior: "smooth", block: "center" });

    const updatePosition = () => {
      const rect = target.getBoundingClientRect();
      const cardWidth = Math.min(400, window.innerWidth - 24);
      const cardHeight = 220;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top =
        spaceBelow >= cardHeight + 16
          ? Math.min(rect.bottom + 12, window.innerHeight - cardHeight - 12)
          : Math.max(12, rect.top - cardHeight - 12);
      const centeredLeft = rect.left + rect.width / 2 - cardWidth / 2;
      const left = Math.max(12, Math.min(centeredLeft, window.innerWidth - cardWidth - 12));
      setBoxPosition({ top, left });
    };

    const timer = window.setTimeout(updatePosition, 220);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      target.style.outline = previousOutline;
      target.style.outlineOffset = previousOffset;
    };
  }, [open, current.target]);

  const close = () => {
    try { localStorage.setItem(GUIDE_KEY, "seen"); } catch { /* Closing does not depend on storage. */ }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent
        overlayClassName="bg-black/15 backdrop-blur-none"
        style={
          boxPosition
            ? {
                top: `${boxPosition.top}px`,
                left: `${boxPosition.left}px`,
                transform: "none",
              }
            : undefined
        }
        className="w-[calc(100vw-24px)] max-w-[400px] rounded-xl border-[#EDEEEF] bg-white p-6 font-syne shadow-xl"
      >
        <p className="text-xs text-[#3478F6]">User guide · {Math.min(step + 1, steps.length)} of {steps.length}</p>
        <DialogTitle className="pr-4 text-lg text-[#191919]">{current.title}</DialogTitle>
        <DialogDescription className="text-sm leading-6 text-[#666666]">{current.description}</DialogDescription>
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={close} className="text-xs text-[#808080] hover:text-[#191919]">Skip guide</button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" onClick={() => setStep((value) => value - 1)}>Back</Button>}
            <Button className="bg-[#3478F6] text-white hover:bg-[#6847E8]" onClick={() => step >= steps.length - 1 ? close() : setStep((value) => value + 1)}>{step >= steps.length - 1 ? "Get started" : "Next"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

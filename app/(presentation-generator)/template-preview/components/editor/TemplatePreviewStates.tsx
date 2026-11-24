"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplatesSkeleton } from "@/components/ui/skeleton";

export function TemplatePreviewLoadingState() {
  return (
    <div className="min-h-screen bg-[#FAFAFB] dark:bg-zinc-950 p-6">
      <TemplatesSkeleton />
    </div>
  );
}

export function TemplatePreviewErrorState({
  error,
  onBack,
}: {
  error: string | null | undefined;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFB] dark:bg-zinc-950 px-6 text-center">
      <h2 className="mb-3 text-2xl font-semibold text-[#191919] dark:text-white">
        Error loading template
      </h2>
      <p className="mb-6 max-w-lg text-sm text-[#696969] dark:text-neutral-400">{error}</p>
      <Button onClick={onBack} variant="outline">
        <ArrowLeft className="h-4 w-4" />
        Back to Templates
      </Button>
    </div>
  );
}

export function TemplatePreviewNotFoundState({
  onBack,
}: {
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFB] dark:bg-zinc-950 px-6 text-center">
      <h2 className="mb-6 text-2xl font-semibold text-[#191919] dark:text-white">
        Template not found
      </h2>
      <Button onClick={onBack} variant="outline">
        <ArrowLeft className="h-4 w-4" />
        Back to Templates
      </Button>
    </div>
  );
}

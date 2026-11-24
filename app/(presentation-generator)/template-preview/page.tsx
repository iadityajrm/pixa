import React, { Suspense } from "react";
import TemplatePreviewClient from "./components/TemplatePreviewClient";
import { redirect } from "next/navigation";
import { normalizePresentationGenerationMode } from "@/utils/presentationGenerationMode";
import { TemplatesSkeleton } from "@/components/ui/skeleton";

const TemplatePreviewPage = () => {
  if (
    normalizePresentationGenerationMode(
      process.env.PRESENTATION_GENERATION_MODE,
    ) === "smart"
  ) {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={<TemplatesSkeleton />}>
      <TemplatePreviewClient />
    </Suspense>
  );
};

export default TemplatePreviewPage;

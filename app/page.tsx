import React from "react";
import HybridUploadLanding from "./(presentation-generator)/upload/components/HybridUploadLanding";
import { Metadata } from "next";
import { normalizePresentationGenerationMode } from "@/utils/presentationGenerationMode";
import { isCommunityEnabled } from "@/utils/community";

export const metadata: Metadata = {
  title: "Pixa — AI presentations, made simple.",
  description:
    "AI presentation generator with custom layouts, multi-model support, and PDF/PPTX export. Turn prompts or documents into presentations with AI.",
  alternates: {
    canonical: "https://presenton.ai",
  },
  keywords: [
    "presentation generator",
    "AI presentations",
    "data visualization",
    "automatic presentation maker",
    "professional slides",
    "data-driven presentations",
    "document to presentation",
    "presentation automation",
    "smart presentation tool",
    "business presentations",
  ],
  openGraph: {
    title: "Pixa — AI presentations, made simple.",
    description:
      "AI presentation generator with custom layouts, multi-model support, and PDF/PPTX export.",
    type: "website",
    url: "https://presenton.ai",
    siteName: "Pixa",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pixa — AI presentations, made simple.",
    description:
      "AI presentation generator with custom layouts, multi-model support, and PDF/PPTX export.",
  },
};

const page = () => {
  const presentationGenerationMode = normalizePresentationGenerationMode(
    process.env.PRESENTATION_GENERATION_MODE,
  );

  return (
    <HybridUploadLanding
      communityEnabled={isCommunityEnabled(process.env.PRESENTON_COMMUNITY_ENABLED)}
      presentationGenerationMode={presentationGenerationMode}
    />
  );
};

export default page;

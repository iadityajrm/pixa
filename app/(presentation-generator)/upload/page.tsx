import React from "react";
import HybridUploadLanding from "./components/HybridUploadLanding";
import { Metadata } from "next";
import { normalizePresentationGenerationMode } from "@/utils/presentationGenerationMode";
import { isCommunityEnabled } from "@/utils/community";

export const metadata: Metadata = {
  title: "Pixa — AI presentations, made simple.",
  description:
    "AI presentation generator with custom layouts, multi-model support, and PDF/PPTX export. Turn prompts or documents into presentations with AI.",
  alternates: {
    canonical: "https://presenton.ai/create",
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
    url: "https://presenton.ai/create",
    siteName: "Pixa",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pixa — AI presentations, made simple.",
    description:
      "AI presentation generator with custom layouts, multi-model support, and PDF/PPTX export.",
  },
};

import { redirect } from "next/navigation";

const page = () => {
  redirect("/");
};

export default page;

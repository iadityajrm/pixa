import React, { Suspense } from "react";
import { Metadata } from "next";
import OutlinePage from "./components/OutlinePage";
import { OutlineSkeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Outline Presentation | Pixa, by Framewrk",
  description: "Customize and organize your presentation outline. Drag and drop slides, add charts, and generate your presentation with ease.",
  alternates: {
    canonical: "https://presenton.ai/create"
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
    "business presentations"
  ]
};

const page = () => {
  return (
    <div className="relative min-h-screen bg-background text-foreground" translate="no">
      <Suspense fallback={<OutlineSkeleton />}>
        <OutlinePage />
      </Suspense>
    </div>
  );
};

export default page;

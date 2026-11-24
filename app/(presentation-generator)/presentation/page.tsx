'use client';

import React, { Suspense } from "react";
import PresentationPage from "./components/PresentationPage";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { PresentationSkeleton } from "@/components/ui/skeleton";
import "../utils/prism-languages";

function PresentationContent() {
  const router = useRouter();
  const params = useSearchParams();
  const queryId = params.get("id");

  if (!queryId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen font-syne bg-background text-foreground">
        <h1 className="text-2xl font-bold">No presentation id found</h1>
        <p className="text-muted-foreground pb-4">Please try again</p>
        <Button onClick={() => router.push("/dashboard")}>Go to home</Button>
      </div>
    );
  }

  return <PresentationPage presentation_id={queryId} />;
}

export default function Page() {
  return (
    <Suspense fallback={<PresentationSkeleton />}>
      <PresentationContent />
    </Suspense>
  );
}

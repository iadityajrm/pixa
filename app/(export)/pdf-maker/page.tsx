'use client';

import React, { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import PdfMakerPage from "./PdfMakerPage";

function PdfMakerContent() {
  const router = useRouter();
  const params = useSearchParams();
  const queryId = params.get("id");
  const exportCookie = params.get("exportCookie") ?? undefined;

  if (!queryId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground">
        <h1 className="text-2xl font-bold">No presentation id found</h1>
        <p className="text-muted-foreground pb-4">Please try again</p>
        <Button onClick={() => router.push("/dashboard")}>Go to home</Button>
      </div>
    );
  }

  return <PdfMakerPage presentation_id={queryId} exportCookie={exportCookie} />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-background text-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-[#3478F6]" />
        </div>
      }
    >
      <PdfMakerContent />
    </Suspense>
  );
}

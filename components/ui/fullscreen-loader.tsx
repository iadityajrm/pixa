"use client";

import { cn } from "@/lib/utils";

interface FullscreenLoaderProps {
  message?: string;
  className?: string;
}

export function FullscreenLoader({
  message = "Please wait…",
  className,
}: FullscreenLoaderProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-[2147483000] flex flex-col items-center justify-center gap-4 bg-white/95 backdrop-blur-sm dark:bg-[#101323]/95",
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-[#E9E5FF] border-t-[#3478F6] animate-spin dark:border-neutral-700 dark:border-t-[#3478F6]" />
    </div>
  );
}

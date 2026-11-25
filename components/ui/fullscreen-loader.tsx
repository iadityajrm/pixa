"use client";

import { cn } from "@/lib/utils";

interface FullscreenLoaderProps {
  show?: boolean;
  message?: string;
  extraInfo?: string;
  progress?: number;
  progressLabel?: string;
  className?: string;
}

export function FullscreenLoader({
  show = true,
  message,
  extraInfo,
  progress,
  progressLabel,
  className,
}: FullscreenLoaderProps) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-[2147483000] flex flex-col items-center justify-center gap-4 bg-white/95 px-6 dark:bg-[#101323]/95",
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-[#E9E5FF] border-t-[#3478F6] animate-spin dark:border-neutral-700 dark:border-t-[#3478F6]" />
      {(message || extraInfo) && (
        <div className="max-w-md space-y-1 text-center">
          {message && (
            <p className="text-base font-semibold text-[#101323] dark:text-white">
              {message}
            </p>
          )}
          {extraInfo && (
            <p className="text-xs text-[#667085] dark:text-neutral-400">
              {extraInfo}
            </p>
          )}
        </div>
      )}
      {typeof progress === "number" && (
        <div className="w-full max-w-md space-y-1.5 text-center">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-[#3478F6] transition-all duration-500 ease-out"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          {progressLabel && (
            <p className="text-xs font-medium text-[#3478F6]">{progressLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}

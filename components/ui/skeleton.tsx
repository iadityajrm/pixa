import { cn } from "@/lib/utils";
import React from "react";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-neutral-200/80 dark:bg-neutral-800/80", className)}
      {...props}
    />
  );
}

/** Dashboard page skeleton */
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen w-full px-3 pb-10 sm:px-6 animate-page-stagger">
      <div className="sticky top-0 right-0 z-50 py-[28px] backdrop-blur mb-2 flex items-center justify-between">
        <Skeleton className="h-9 w-52 rounded-lg" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
      <section className="relative z-10 overflow-visible">
        <Skeleton className="h-5 w-20 mb-4" />
        <div className="grid w-full max-w-[625px] grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-[90px] w-full rounded-[10.8px]" />
          <Skeleton className="h-[90px] w-full rounded-[10.8px]" />
        </div>
      </section>
      <section className="relative z-10 mt-12">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-5 w-16" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="flex min-h-[216px] flex-col overflow-hidden rounded-[12px] border border-[#EDEEEF] dark:border-neutral-800 bg-[#F8FBFB] dark:bg-neutral-900/40"
            >
              <div className="relative flex-1 p-4">
                <Skeleton className="mx-auto mt-2 aspect-video w-[90%] rounded-lg" />
              </div>
              <div className="border-t border-[#EDEEEF] dark:border-neutral-800 bg-white dark:bg-neutral-900 px-5 py-3 flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-28 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Presentation Editor skeleton */
export function PresentationSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("h-dvh w-full overflow-hidden flex flex-col bg-background font-syne select-none", className)}>
      {/* Top Header skeleton */}
      <div className="h-14 w-full border-b border-border/60 bg-white dark:bg-neutral-900 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-44 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      {/* Main Workspace skeleton */}
      <div className="flex flex-1 min-h-0 gap-4 p-4 overflow-hidden">
        {/* Left thumbnails panel */}
        <div className="w-[165px] shrink-0 hidden md:flex flex-col gap-3 py-2 pr-2 border-r border-border/40">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 p-2 rounded-lg border border-border/40 bg-card">
              <Skeleton className="aspect-video w-full rounded" />
              <Skeleton className="h-2.5 w-12 rounded" />
            </div>
          ))}
        </div>

        {/* Center active slide canvas */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-[1100px] aspect-video rounded-2xl border border-border/60 bg-card p-8 flex flex-col justify-between shadow-sm">
            <div className="space-y-3">
              <Skeleton className="h-8 w-2/5 rounded-lg" />
              <Skeleton className="h-4 w-3/5 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-6 my-auto">
              <div className="space-y-3 p-4 rounded-xl border border-border/30 bg-muted/30">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-5/6 rounded" />
              </div>
              <div className="space-y-3 p-4 rounded-xl border border-border/30 bg-muted/30">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-5/6 rounded" />
              </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-border/40">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-8 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Outline Page skeleton */
export function OutlineSkeleton() {
  return (
    <div className="min-h-screen bg-background font-syne animate-page-stagger">
      <div className="h-16 w-full border-b border-border/60 px-6 flex items-center justify-between">
        <Skeleton className="h-6 w-36 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-4 mb-8">
          <Skeleton className="h-8 w-1/3 rounded-lg" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
        </div>
        <div className="border border-border/60 rounded-xl p-4 sm:p-6 space-y-4 bg-card">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-border/40 bg-muted/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/3 rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                </div>
              </div>
              <Skeleton className="h-8 w-8 rounded-md shrink-0" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Skeleton className="h-11 w-44 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** Plans / Pricing skeleton */
export function PlansSkeleton() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto font-syne animate-page-stagger">
      <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
        <Skeleton className="h-7 w-32 mx-auto rounded-full" />
        <Skeleton className="h-10 w-3/4 mx-auto rounded-lg" />
        <Skeleton className="h-4 w-1/2 mx-auto rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-3xl border border-border/60 bg-card p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-6 w-28 rounded-md" />
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-12 w-32 rounded-xl" />
              <div className="space-y-3 pt-4 border-t border-border/40">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-3.5 flex-1 rounded" />
                  </div>
                ))}
              </div>
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Subscription / Account skeleton */
export function SubscriptionSkeleton() {
  return (
    <div className="min-h-full py-10 px-4 sm:px-8 max-w-5xl mx-auto font-syne animate-page-stagger">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-10 w-20 rounded-lg" />
            <Skeleton className="h-3.5 w-3/4 rounded" />
          </div>
        ))}
      </div>
      <div className="mt-12 space-y-4">
        <Skeleton className="h-6 w-48 rounded-md" />
        <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-border/20 last:border-none">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Templates skeleton */
export function TemplatesSkeleton() {
  return (
    <div className="min-h-screen px-6 py-8 font-syne animate-page-stagger">
      <div className="flex items-center justify-between pb-6">
        <Skeleton className="h-8 w-44 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic page skeleton */
export function PageSkeleton() {
  return (
    <div className="min-h-[80vh] w-full max-w-6xl mx-auto p-6 space-y-6 font-syne animate-page-stagger">
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/4 rounded-lg" />
        <Skeleton className="h-4 w-2/5 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl mt-6" />
    </div>
  );
}

export { Skeleton };

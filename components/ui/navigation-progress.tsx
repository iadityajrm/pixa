"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const safetyRef = useRef<number | null>(null);

  const stopNavigation = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (safetyRef.current) {
      window.clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
    setProgress(100);
    window.setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
    }, 180);
  };

  const startNavigation = () => {
    setIsNavigating(true);
    setProgress(18);
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (safetyRef.current) window.clearTimeout(safetyRef.current);

    timerRef.current = window.setInterval(() => {
      setProgress((prev) => (prev < 88 ? prev + Math.max(2, (88 - prev) * 0.14) : prev));
    }, 180);

    safetyRef.current = window.setTimeout(() => {
      stopNavigation();
    }, 12000);
  };

  useEffect(() => {
    stopNavigation();
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }
        startNavigation();
      } catch {
        // Ignore malformed URLs.
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (safetyRef.current) window.clearTimeout(safetyRef.current);
    };
  }, []);

  if (!isNavigating) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] h-[3px] bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-[#3478F6] via-[#6847E8] to-[#3478F6] shadow-[0_0_8px_rgba(52,120,246,0.6)] transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}

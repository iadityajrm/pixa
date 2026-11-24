"use client";

import { useLayoutEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface PresentonSplashLoaderProps {
  message?: string;
  className?: string;
}

// First-load gate shown by ConfigurationInitializer. Keep it short: real
// configuration work decides how long the loader stays up.
export const PRESENTON_SPLASH_MIN_DURATION_MS = 800;

/** Session flag used to show the branded splash only on the first cold start. */
export const SPLASH_SHOWN_SESSION_KEY = "pixa:startup-splash-shown";

export function markStartupSplashConsumed(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SPLASH_SHOWN_SESSION_KEY, "1");
  } catch {
    // Storage can be unavailable; the splash is only a branding delay.
  }
}

const SPLASH_ANIMATION_MS = 2600;
const SPLASH_MASK_SRC = "/Presenton_Splash.png";

let splashSessionStartedAt: number | null = null;
let splashMaskReadyPromise: Promise<void> | null = null;

function markSplashSessionStart(): number {
  if (splashSessionStartedAt === null) {
    splashSessionStartedAt = Date.now();
  }
  return splashSessionStartedAt;
}

function getSplashAnimationDelayMs(): number {
  const elapsed = Date.now() - markSplashSessionStart();
  return -Math.min(elapsed, SPLASH_ANIMATION_MS);
}

function ensureSplashMaskReady(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (!splashMaskReadyPromise) {
    splashMaskReadyPromise = new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      const finish = () => resolve();
      img.onload = finish;
      img.onerror = finish;
      img.src = SPLASH_MASK_SRC;
      if (img.complete) {
        finish();
      }
    });
  }

  return splashMaskReadyPromise;
}

export function PresentonSplashLoader({
  message = "Preparing your workspace",
  className,
}: PresentonSplashLoaderProps) {
  const [isWordmarkReady, setIsWordmarkReady] = useState(false);
  const [animationDelayMs, setAnimationDelayMs] = useState(0);

  useLayoutEffect(() => {
    setAnimationDelayMs(getSplashAnimationDelayMs());

    let cancelled = false;
    void ensureSplashMaskReady().then(() => {
      if (!cancelled) {
        setIsWordmarkReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const containerStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 2147483000,
    display: "flex",
    minHeight: "100vh",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background: "#ffffff",
  };

  const surfaceStyle: CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "142vmax",
    height: "142vmax",
    borderRadius: "50%",
    background: "#3478F6",
    transform: "translate3d(-50%, -50%, 0) scale(0.001)",
    animation: `presenton-splash-surface-grow ${SPLASH_ANIMATION_MS}ms linear ${animationDelayMs}ms both`,
    willChange: "transform",
    backfaceVisibility: "hidden",
  };

  const wordmarkStyle: CSSProperties = {
    position: "relative",
    zIndex: 1,
    transform: "translateZ(0)",
    width: "min(56vw, 511.5px)",
    aspectRatio: "1023 / 342",
    visibility: isWordmarkReady ? "visible" : "hidden",
  };

  const wordmarkLayerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    maskImage: `url('${SPLASH_MASK_SRC}')`,
    maskRepeat: "no-repeat",
    maskPosition: "center",
    maskSize: "contain",
    WebkitMaskImage: `url('${SPLASH_MASK_SRC}')`,
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    WebkitMaskSize: "contain",
  };

  return (
    <main
      aria-busy="true"
      aria-label={message}
      className={cn("presenton-splash-loader", className)}
      role="status"
      style={containerStyle}
    >
      <div
        className="presenton-splash-surface"
        aria-hidden="true"
        style={surfaceStyle}
      />
      <div
        className="presenton-splash-wordmark"
        aria-hidden="true"
        style={wordmarkStyle}
      >
        <span
          className="presenton-splash-wordmark-layer presenton-splash-wordmark-base"
          style={{
            ...wordmarkLayerStyle,
            background: "#3478F6",
          }}
        />
        <span
          className="presenton-splash-wordmark-layer presenton-splash-wordmark-reveal"
          style={{
            ...wordmarkLayerStyle,
            background: "#ffffff",
            clipPath: "circle(0 at 50% 50%)",
            animation: `presenton-splash-text-reveal ${SPLASH_ANIMATION_MS}ms linear ${animationDelayMs}ms both`,
            willChange: "clip-path",
          }}
        />
      </div>
    </main>
  );
}

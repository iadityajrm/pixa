"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  TAILWIND_BROWSER_SCRIPT_URL,
  TAILWIND_BROWSER_STYLE_CONTENT,
} from "@/lib/tailwind-browser";

export const TAILWIND_RUNTIME_READY_EVENT =
  "presenton:tailwind-runtime-ready";
export const TAILWIND_RUNTIME_REQUEST_EVENT =
  "presenton:tailwind-runtime-request";

let runtimeReady = false;

function notifyRuntimeReady() {
  if (runtimeReady) return;
  runtimeReady = true;
  window.dispatchEvent(new Event(TAILWIND_RUNTIME_READY_EVENT));
}

export default function TailwindBrowserRuntime() {
  const pathname = usePathname();
  const [loadRequested, setLoadRequested] = useState(false);

  useEffect(() => {
    // The browser compiler parses and JITs CSS on the main thread, so it must
    // only ship to routes that actually render runtime-scoped template HTML.
    if (pathname === "/pdf-maker") return;

    const handleRequest = () => setLoadRequested(true);
    if (runtimeReady) {
      handleRequest();
    }
    window.addEventListener(TAILWIND_RUNTIME_REQUEST_EVENT, handleRequest);
    return () =>
      window.removeEventListener(TAILWIND_RUNTIME_REQUEST_EVENT, handleRequest);
  }, [pathname]);

  if (pathname === "/pdf-maker") return null;
  if (!loadRequested) return null;

  return (
    <>
      <style
        data-presenton-tailwind-browser-style="true"
        dangerouslySetInnerHTML={{ __html: TAILWIND_BROWSER_STYLE_CONTENT }}
        type="text/tailwindcss"
      />
      <Script
        id="presenton-shared-tailwind-runtime"
        onLoad={notifyRuntimeReady}
        onReady={notifyRuntimeReady}
        src={TAILWIND_BROWSER_SCRIPT_URL}
        strategy="afterInteractive"
      />
    </>
  );
}

export function useTailwindRuntimeReady() {
  const [ready, setReady] = useState(runtimeReady);

  useEffect(() => {
    const requestTimer = window.setTimeout(() => {
      window.dispatchEvent(new Event(TAILWIND_RUNTIME_REQUEST_EVENT));
    }, 0);
    const handleReady = () => setReady(true);
    window.addEventListener(TAILWIND_RUNTIME_READY_EVENT, handleReady);
    return () => {
      window.clearTimeout(requestTimer);
      window.removeEventListener(TAILWIND_RUNTIME_READY_EVENT, handleReady);
    };
  }, []);

  return ready;
}

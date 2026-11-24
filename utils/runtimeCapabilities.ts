"use client";

import { useEffect, useState } from "react";

export interface RuntimeCapabilities {
  engine: "v3" | "legacy";
  chat_enabled: boolean;
  image_generation_enabled: boolean;
  export_enabled: boolean;
  max_slides: number;
}

const DEFAULT_CAPABILITIES: RuntimeCapabilities = {
  engine: "legacy",
  chat_enabled: true,
  image_generation_enabled: true,
  export_enabled: true,
  max_slides: 12,
};

let cachedRequest: Promise<RuntimeCapabilities> | null = null;

export function loadRuntimeCapabilities(): Promise<RuntimeCapabilities> {
  if (!cachedRequest) {
    cachedRequest = fetch("/api/runtime-capabilities", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as Partial<RuntimeCapabilities>;
        return {
          ...DEFAULT_CAPABILITIES,
          ...payload,
          engine: payload.engine === "v3" ? ("v3" as const) : ("legacy" as const),
        };
      })
      .catch((error) => {
        console.warn("Runtime capabilities unavailable:", error);
        return DEFAULT_CAPABILITIES;
      });
  }
  return cachedRequest;
}

export function useRuntimeCapabilities(): RuntimeCapabilities {
  const [capabilities, setCapabilities] =
    useState<RuntimeCapabilities>(DEFAULT_CAPABILITIES);

  useEffect(() => {
    let active = true;
    void loadRuntimeCapabilities().then((next) => {
      if (active) setCapabilities(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return capabilities;
}

// Image / icon placeholder and asset resolution for generated slides.
import { searchIcons } from "@/lib/v3/services/iconSearchService";
import { getProviderSettings } from "@/lib/v3/services/adminKeyPoolService";

type Dict = Record<string, any>;

const IMAGE_PROMPT_KEYS = ["__image_prompt__", "image_prompt", "prompt"];
const ICON_QUERY_KEYS = ["__icon_query__", "icon_query", "query"];
const ICON_URL_KEYS = ["icon_url", "__icon_url__"];
const IMAGE_URL_KEYS = ["image_url", "__image_url__"];

export const PLACEHOLDER_IMAGE_URL = "/static/images/placeholder.jpg";
export const PLACEHOLDER_ICON_URL = "/static/icons/placeholder.svg";

const STOCK_PLACEHOLDERS = [
  "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200",
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200",
];

function isRecord(value: unknown): value is Dict {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function promptValue(value: Dict, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function setAssetUrl(asset: Dict, assetType: "image" | "icon", url: string) {
  asset[`${assetType}_url`] = url;
  if (`__${assetType}_url__` in asset) asset[`__${assetType}_url__`] = url;
}

export interface AssetSlot {
  asset: Dict;
  prompt: string;
  kind: "image" | "icon";
}

export function collectAssetSlots(content: unknown): AssetSlot[] {
  const slots: AssetSlot[] = [];

  const visit = (value: any) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;

    const imagePrompt = promptValue(value, IMAGE_PROMPT_KEYS);
    if (imagePrompt) slots.push({ asset: value, prompt: imagePrompt, kind: "image" });
    const iconQuery = promptValue(value, ICON_QUERY_KEYS);
    if (iconQuery) slots.push({ asset: value, prompt: iconQuery, kind: "icon" });

    for (const nested of Object.values(value)) visit(nested);
  };

  visit(content);
  return slots;
}

export function addPlaceholderAssets(content: unknown): void {
  for (const slot of collectAssetSlots(content)) {
    if (slot.kind === "image") {
      setAssetUrl(slot.asset, "image", PLACEHOLDER_IMAGE_URL);
    } else {
      setAssetUrl(slot.asset, "icon", PLACEHOLDER_ICON_URL);
    }
  }
}

function hashPrompt(prompt: string): number {
  let hash = 0;
  for (let index = 0; index < prompt.length; index += 1) {
    hash = (hash * 31 + prompt.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

let cachedPexelsKey: { value: string | null; expiresAt: number } | null = null;

async function resolvePexelsApiKey(): Promise<string | null> {
  const fromEnv = process.env.PEXELS_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  if (cachedPexelsKey && cachedPexelsKey.expiresAt > Date.now()) {
    return cachedPexelsKey.value;
  }
  let value: string | null = null;
  try {
    const settings = await getProviderSettings();
    const candidate = settings?.PEXELS_API_KEY ?? settings?.PEXELS_KEY;
    if (typeof candidate === "string" && candidate.trim()) {
      value = candidate.trim();
    }
  } catch {
    value = null;
  }
  cachedPexelsKey = { value, expiresAt: Date.now() + 60_000 };
  return value;
}

async function findStockImage(prompt: string): Promise<string> {
  const apiKey = await resolvePexelsApiKey();
  if (apiKey) {
    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(
          prompt,
        )}&per_page=3&orientation=landscape`,
        { headers: { Authorization: apiKey } },
      );
      if (response.ok) {
        const data = await response.json();
        const url = (data.photos || [])
          .map((photo: any) => photo?.src?.large || photo?.src?.medium)
          .find((candidate: unknown) => typeof candidate === "string");
        if (url) return url;
      }
    } catch {
      // Fall through to static stock imagery.
    }
  }
  return STOCK_PLACEHOLDERS[hashPrompt(prompt) % STOCK_PLACEHOLDERS.length];
}

function normalizeIconWeight(weight: string | null | undefined): string {
  // Only the regular icon set is bundled with the serverless build.
  return weight ? "regular" : "regular";
}

export async function resolveSlideAssets(
  content: unknown,
  options: { iconWeight?: string | null } = {},
): Promise<string[]> {
  const warnings: string[] = [];
  const slots = collectAssetSlots(content);
  if (!slots.length) return warnings;

  await Promise.all(
    slots.map(async (slot) => {
      try {
        if (slot.kind === "image") {
          const url = await findStockImage(slot.prompt);
          setAssetUrl(slot.asset, "image", url);
          return;
        }
        const icons = await searchIcons(
          slot.prompt,
          1,
          normalizeIconWeight(options.iconWeight),
        );
        setAssetUrl(slot.asset, "icon", icons[0] || PLACEHOLDER_ICON_URL);
      } catch {
        if (slot.kind === "image") {
          setAssetUrl(slot.asset, "image", PLACEHOLDER_IMAGE_URL);
          warnings.push("Some slide images could not be resolved.");
        } else {
          setAssetUrl(slot.asset, "icon", PLACEHOLDER_ICON_URL);
        }
      }
    }),
  );

  return [...new Set(warnings)];
}

export function assetUrl(
  asset: Dict,
  assetType: "image" | "icon",
): string | null {
  const keys = assetType === "image" ? IMAGE_URL_KEYS : ICON_URL_KEYS;
  for (const key of keys) {
    const value = asset[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

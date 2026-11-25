import { generateJsonWithConfiguredProvider } from "@/lib/v3/llm";

export interface BrokenSlidePayload {
  index: number;
  outline: string;
  content: Record<string, unknown>;
}

/**
 * Extracts only text/numeric fields from a slide's content so we don't waste
 * tokens sending image URLs, base64 data, or layout metadata.
 */
function pickCompactTextFields(
  content: Record<string, unknown>,
  depth = 0
): Record<string, unknown> {
  if (depth > 3) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content)) {
    if (key.startsWith("__")) continue;
    if (typeof value === "string") {
      result[key] = value.slice(0, 220);
    } else if (typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.slice(0, 6).map((item) =>
        item && typeof item === "object"
          ? pickCompactTextFields(item as Record<string, unknown>, depth + 1)
          : typeof item === "string"
            ? item.slice(0, 140)
            : item
      );
    } else if (value && typeof value === "object") {
      result[key] = pickCompactTextFields(
        value as Record<string, unknown>,
        depth + 1
      );
    }
  }
  return result;
}

/**
 * Last-resort batched repair: sends only the broken slides in a single
 * token-efficient JSON call and returns a map of `slideIndex -> patchedFields`.
 */
export async function repairBrokenSlidesBatch(
  brokenSlides: BrokenSlidePayload[],
  language?: string
): Promise<Record<number, Record<string, unknown>>> {
  if (brokenSlides.length === 0) return {};

  const compactPayload = brokenSlides.map((s) => ({
    index: s.index,
    outline: s.outline.slice(0, 240),
    fields: pickCompactTextFields(s.content),
  }));

  const prompt = [
    "Fix only the broken, truncated, or repeated text fields in these presentation slides.",
    "Rules:",
    "- Never cut words mid-sentence or repeat the title in body/card fields.",
    "- Keep each field concise so it fits its card/heading without overflowing.",
    language ? `- Write in ${language}.` : "",
    "- Return a JSON object keyed by slide index (as strings), containing only the repaired fields.",
    JSON.stringify(compactPayload),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const repaired = await generateJsonWithConfiguredProvider<
      Record<string, Record<string, unknown>>
    >({
      prompt,
      temperature: 0.3,
    });

    const out: Record<number, Record<string, unknown>> = {};
    if (repaired && typeof repaired === "object") {
      for (const [key, val] of Object.entries(repaired)) {
        const idx = Number(key);
        if (Number.isInteger(idx) && val && typeof val === "object") {
          out[idx] = val;
        }
      }
    }
    return out;
  } catch (err) {
    console.warn("[batched-slide-repair] batch repair failed:", err);
    return {};
  }
}

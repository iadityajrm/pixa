// Layout model + structure selection ported from servers/fastapi
import { callLLMChatCompletion } from "@/lib/v3/services/llmService";
import { getTemplateSchema, type TemplateLayoutSchemaEntry } from "./templateSchema";
import type {
  JsonObject,
  PresentationLayoutModel,
  TemplateLayout,
  TemplateLayoutEntry,
} from "./types";

type Dict = Record<string, any>;

const DEFAULT_ICON_TYPE = "regular";

export interface TemplatePayload {
  name: string;
  template_id: string;
  icon_type: string;
  icon_weight: string;
  layouts: TemplateLayout[];
  merged_components: any[];
  fonts: Record<string, string> | null;
  theme: JsonObject | null;
}

function isRecord(value: unknown): value is Dict {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rewriteTemplateAssetPath(value: string, templateId: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return value;
  }
  if (/^(?:https?:)?\/\//i.test(trimmed) || trimmed.startsWith("/")) return value;
  if (
    /^(?:static|app_data|images|uploads|fonts)\//.test(trimmed) &&
    templateId
  ) {
    return `/templates/${encodeURIComponent(templateId)}/${trimmed}`;
  }
  return value;
}

export function rewriteTemplateAssetPaths<T>(value: T, templateId: string): T {
  if (typeof value === "string") {
    return rewriteTemplateAssetPath(value, templateId) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      rewriteTemplateAssetPaths(item, templateId),
    ) as unknown as T;
  }
  if (isRecord(value)) {
    const result: Dict = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = rewriteTemplateAssetPaths(item, templateId);
    }
    return result as T;
  }
  return value;
}

export function normalizeTemplatePayload(template: Dict): TemplatePayload {
  const templateId = String(template.id ?? template.template_id ?? "");
  const rawLayouts = Array.isArray(template.layouts)
    ? template.layouts
    : isRecord(template.layouts) && Array.isArray(template.layouts.layouts)
      ? template.layouts.layouts
      : [];

  const layouts = rewriteTemplateAssetPaths(
    rawLayouts.filter(isRecord),
    templateId,
  );
  const mergedComponents = Array.isArray(template.merged_components)
    ? rewriteTemplateAssetPaths(
        template.merged_components.filter(isRecord),
        templateId,
      )
    : [];

  const rawFonts = isRecord(template.fonts)
    ? template.fonts
    : isRecord(template.assets) && isRecord(template.assets.fonts)
      ? template.assets.fonts
      : null;
  const fonts: Record<string, string> | null = rawFonts
    ? Object.fromEntries(
        Object.entries(rawFonts)
          .filter(
            ([name, url]) =>
              typeof name === "string" && typeof url === "string" && name && url,
          )
          .map(([name, url]) => [
            name,
            rewriteTemplateAssetPath(String(url), templateId),
          ]),
      )
    : null;

  const iconTypeSource = isRecord(template.assets) ? template.assets : template;

  return {
    name: templateId,
    template_id: templateId,
    icon_type:
      (typeof iconTypeSource.icon_type === "string" &&
        iconTypeSource.icon_type) ||
      DEFAULT_ICON_TYPE,
    icon_weight: DEFAULT_ICON_TYPE,
    layouts,
    merged_components: mergedComponents,
    fonts: fonts && Object.keys(fonts).length ? fonts : null,
    theme: isRecord(template.theme) ? template.theme : null,
  };
}

function layoutSchemaTitle(schema: JsonObject | null): string | null {
  return schema && typeof schema.title === "string" ? schema.title : null;
}

export function buildTemplateLayoutModel(
  payload: TemplatePayload,
  layoutName = payload.name,
): PresentationLayoutModel {
  const templateSchema = getTemplateSchema({
    layouts: payload.layouts,
    merged_components: payload.merged_components,
  });

  const slides: TemplateLayoutEntry[] = [];
  templateSchema.layouts.forEach(
    (schemaLayout: TemplateLayoutSchemaEntry, index: number) => {
      const sourceLayout =
        index < payload.layouts.length && isRecord(payload.layouts[index])
          ? payload.layouts[index]
          : ({} as TemplateLayout);

      const layoutId = String(
        schemaLayout.layout_id ?? sourceLayout.id ?? `layout_${index + 1}`,
      );
      const schema =
        schemaLayout.schema ??
        ({
          title: layoutId,
          description: sourceLayout.description ?? null,
        } as JsonObject);

      slides.push({
        id: layoutId,
        name:
          (typeof sourceLayout.name === "string" && sourceLayout.name) ||
          layoutSchemaTitle(schema),
        description:
          (typeof sourceLayout.description === "string" &&
            sourceLayout.description) ||
          (typeof schema.description === "string" ? schema.description : null),
        json_schema: schema,
      });
    },
  );

  return {
    name: layoutName,
    ordered: false,
    icon_type: payload.icon_type,
    slides,
  };
}

export function layoutModelToString(
  model: PresentationLayoutModel,
  withSchema = false,
): string {
  let message = "## Presentation Layout\n\n";
  model.slides.forEach((slide, index) => {
    message += `### Slide Layout: ${index}\n`;
    message += `- Name: ${slide.name || slide.json_schema?.title || slide.id}\n`;
    message += `- Description: ${slide.description ?? "None"}\n`;
    if (withSchema && slide.json_schema) {
      message += `- Schema: ${JSON.stringify(slide.json_schema)}\n`;
    }
    message += "\n";
  });
  return message;
}

// ---------------------------------------------------------------------------
// Title / TOC layout selection
// ---------------------------------------------------------------------------

const TITLE_LAYOUT_PATTERNS = [
  /title[_-]?slide/i,
  /\bcover\b/i,
  /title[_-]?intro/i,
  /\bhero\b/i,
  /\bopening\b/i,
  /\bbranded\b/i,
];

const TOC_PATTERNS = [
  /\btable\s*of\s*contents\b/i,
  /\btable[- ]?of[- ]?contents\b/i,
  /\bagenda\b/i,
  /\bcontents\b/i,
  /\boutline\b/i,
  /\bindex\b/i,
  /\btoc\b/i,
];

const LIST_PATTERNS = [
  /\b(bullet(ed)?\s*list|bullets?)\b/i,
  /\b(numbered\s*list|ordered\s*list|unordered\s*list)\b/i,
  /\blist\b/i,
];

function findLayoutIndexByPatterns(
  model: PresentationLayoutModel,
  patterns: RegExp[],
): number {
  for (const pattern of patterns) {
    for (let index = 0; index < model.slides.length; index += 1) {
      const slide = model.slides[index];
      const candidates = [
        slide.id,
        slide.name,
        slide.description,
        slide.json_schema?.title,
      ];
      if (candidates.some((text) => typeof text === "string" && pattern.test(text))) {
        return index;
      }
    }
  }
  return -1;
}

export function selectTitleSlideLayoutIndex(
  model: PresentationLayoutModel,
): number {
  const index = findLayoutIndexByPatterns(model, TITLE_LAYOUT_PATTERNS);
  if (index !== -1) return index;
  return model.slides.length ? 0 : -1;
}

export function selectTocOrListSlideLayoutIndex(
  model: PresentationLayoutModel,
): number {
  const tocIndex = findLayoutIndexByPatterns(model, TOC_PATTERNS);
  if (tocIndex !== -1) return tocIndex;
  return findLayoutIndexByPatterns(model, LIST_PATTERNS);
}

function tocCountForTotalSlides(totalSlides: number, titleSlide: boolean): number {
  if (totalSlides <= 0) return 0;
  const firstPass = Math.ceil(
    ((titleSlide ? totalSlides - 1 : totalSlides) || 1) / 10,
  );
  return Math.ceil((totalSlides - firstPass) / 10);
}

export function getNoOfTocRequiredForNOutlines(options: {
  nOutlines: number;
  titleSlide: boolean;
  targetTotalSlides?: number | null;
}): number {
  const { nOutlines, titleSlide, targetTotalSlides } = options;
  if (targetTotalSlides != null) {
    const adjustedTotal = Math.max(targetTotalSlides, nOutlines);
    return tocCountForTotalSlides(adjustedTotal, titleSlide);
  }
  if (nOutlines <= 0) return 0;
  return Math.ceil(((titleSlide ? nOutlines - 1 : nOutlines) || 1) / 10);
}

export function insertTocLayouts(
  structure: number[],
  nTocSlides: number,
  includeTitleSlide: boolean,
  tocLayoutIndex: number,
): number[] {
  if (nTocSlides <= 0 || tocLayoutIndex === -1) return structure;
  const insertionIndex = includeTitleSlide ? 1 : 0;
  const result = [...structure];
  for (let i = 0; i < nTocSlides; i += 1) {
    result.splice(insertionIndex + i, 0, tocLayoutIndex);
  }
  return result;
}

export function getOutlineModelWithToc(
  outlines: string[],
  nTocSlides: number,
  titleSlide: boolean,
): string[] {
  // The FastAPI version rewrites outlines for TOC sections; V3 keeps the
  // reviewed outline text intact and only needs the TOC slide placeholder.
  if (nTocSlides <= 0) return outlines;
  return outlines;
}

export function normalizeStructure(
  slides: number[],
  outlineCount: number,
  layoutCount: number,
): number[] {
  const normalized = slides.slice(0, outlineCount);
  while (normalized.length < outlineCount) {
    normalized.push(Math.floor(Math.random() * layoutCount));
  }
  return normalized.map((layoutIndex) =>
    Number.isInteger(layoutIndex) && layoutIndex >= 0 && layoutIndex < layoutCount
      ? layoutIndex
      : Math.floor(Math.random() * layoutCount),
  );
}

// ---------------------------------------------------------------------------
// LLM structure selection
// ---------------------------------------------------------------------------

const STRUCTURE_SYSTEM_PROMPT = `You are a professional presentation designer with creative freedom to design engaging presentations.

# DESIGN PHILOSOPHY
- Create visually compelling and varied presentations
- Match layout to content purpose and audience needs

# Layout Selection Guidelines
1. **Content-driven choices**: Let the slide's purpose guide layout selection
- Opening/closing -> Title layouts
- Processes/workflows -> Visual process layouts
- Comparisons/contrasts -> Side-by-side layouts
- Data/metrics -> Chart/graph layouts
- Concepts/ideas -> Image + text layouts
- Key insights -> Emphasis layouts

2. **Visual variety**: Aim for diverse slide layouts across the presentation.
- Don't use same layout for multiple slides unless necessary.
- Mix text-heavy and visual-heavy slides naturally.
- Adjacent slide layouts should be different unless instructed or necessary otherwise.

3. **Audience experience**: Consider how slides work together
- Create natural transitions between topics

4. **Table of contents**:
- Must only use table of contents layout if slide content contains table of contents.

{user_instruction_header}

Extract visual constraints from User Instructions and Original User Request; User
Instructions win conflicts. The supplied slide count is authoritative. Slide numbers are
one-based, and "all" or "every" includes the title slide. Prefer exact chart types and
image placements over variety, reusing layouts if needed. A numeric table on a
chart-requested slide is chart data, not a request for a table-only layout.

Select layout index for each of the {n_slides} slides based on what will best serve the presentation's goals.

Available layouts (0-based indexes):
{presentation_layout}

Respond with a JSON object of the form {"slides": [0, 1, 2, ...]} containing exactly one layout index per slide.`;

function outlineToString(outlines: string[]): string {
  let message = "";
  outlines.forEach((content, index) => {
    message += `## Slide ${index + 1}:\n`;
    message += `  - Content: ${content}\n`;
  });
  return message;
}

function parseJsonObject(text: string): Dict | null {
  const cleaned = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return isRecord(parsed) ? parsed : null;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        return isRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function generatePresentationStructure(options: {
  layout: PresentationLayoutModel;
  outlines: string[];
  instructions?: string | null;
  sourceContent?: string | null;
}): Promise<number[]> {
  const { layout, outlines, instructions, sourceContent } = options;
  const nSlides = outlines.length;
  if (!nSlides) return [];
  if (layout.slides.length === 1) return new Array(nSlides).fill(0);

  const intentSections: string[] = [];
  if (instructions) intentSections.push(`# User Instructions:\n${instructions}`);
  if (sourceContent)
    intentSections.push(`# Original User Request:\n${sourceContent.slice(0, 6000)}`);

  const systemPrompt = STRUCTURE_SYSTEM_PROMPT.replace(
    "{user_instruction_header}",
    intentSections.join("\n\n"),
  )
    .replace("{n_slides}", String(nSlides))
    .replace("{presentation_layout}", layoutModelToString(layout, false));

  const userPrompt = `Slides:\n\n${outlineToString(outlines)}`;

  const result = await callLLMChatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.2,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    },
  );

  const parsed = parseJsonObject(result.text);
  const slides = Array.isArray(parsed?.slides) ? parsed!.slides : [];
  return slides
    .map((value: any) => Number(value))
    .filter((value: number) => Number.isInteger(value));
}

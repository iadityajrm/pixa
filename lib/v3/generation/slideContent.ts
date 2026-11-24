// Per-slide structured content generation ported from
// servers/fastapi/utils/llm_calls/generate_slide_content.py
import {
  callLLMChatCompletion,
  type LLMMessage,
  type LLMRetryInfo,
} from "@/lib/v3/services/llmService";
import type { JsonObject, TemplateLayoutEntry } from "./types";
import {
  assessFundamentallyUnusable,
  buildFallbackContent,
  executeSchemaRepairPipeline,
  parseJsonWithRepair,
  validateSchema,
  type RepairDiagnostics,
} from "./schemaRepair";

type Dict = Record<string, any>;

const ASSET_ONLY_FIELDS = ["__image_url__", "__icon_url__"];

export const SLIDE_CONTENT_SYSTEM_PROMPT = `You generate structured slide JSON matching the provided prototype schema and slide outline.
# Rules:
- Synthesize the outline into rich, well-developed content with concrete facts, details, and realistic metrics. Do not copy outline bullets verbatim.
- Populate every field in the response prototype schema.
- When the slide is a title or cover layout, write a short, bold headline (at most 8 words) with a single supporting subtitle.
- Output audience-facing text only (no meta-commentary, commands, or styling commentary).
- Speaker notes must be plain text without markdown.
- Use markdown bold/italics for emphasis. Wrap any mathematical expressions in <latex>...</latex>.
{user_instructions}
{tone_instructions}
{verbosity_instructions}
# Response Schema (return valid JSON conforming to this structure):
{output_fields_instructions}`;

const SLIDE_CONTENT_USER_PROMPT = `{slide_number_section}# Slide Outline:
{content}`;

function isRecord(value: unknown): value is Dict {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function removeFieldsFromSchema(value: any, fields: string[]): any {
  if (Array.isArray(value)) return value.map((item) => removeFieldsFromSchema(item, fields));
  if (!isRecord(value)) return value;
  const result: Dict = {};
  for (const [key, nested] of Object.entries(value)) {
    if (fields.includes(key)) continue;
    result[key] = removeFieldsFromSchema(nested, fields);
  }
  return result;
}

function ensureArraySchemasHaveItems(value: any): any {
  if (Array.isArray(value)) return value.map(ensureArraySchemasHaveItems);
  if (!isRecord(value)) return value;
  const result: Dict = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = ensureArraySchemasHaveItems(nested);
  }
  if (result.type === "array" && !result.items) {
    result.items = { type: "string" };
  }
  return result;
}

export function prepareResponseSchema(
  jsonSchema: JsonObject | null | undefined,
): JsonObject | null {
  if (!isRecord(jsonSchema)) return null;

  const schema = removeFieldsFromSchema(clone(jsonSchema), ASSET_ONLY_FIELDS) as Dict;
  const properties = isRecord(schema.properties) ? schema.properties : null;
  if (!properties || !Object.keys(properties).length) return null;

  if (schema.type !== "object") schema.type = "object";
  properties.__speaker_note__ = {
    type: "string",
    minLength: 100,
    maxLength: 500,
    description: "Speaker note for the slide",
  };
  if (!Array.isArray(schema.required)) schema.required = [];
  schema.required.push("__speaker_note__");

  return ensureArraySchemasHaveItems(schema);
}

export function toCompactPrototype(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;

  if (schema.type === "string") {
    if (schema.enum && Array.isArray(schema.enum)) {
      return `enum(${schema.enum.join("|")})`;
    }
    const parts: string[] = [];
    if (schema.minLength || schema.maxLength) {
      parts.push(`${schema.minLength || 0}-${schema.maxLength || "inf"} chars`);
    }
    if (schema.description && !schema.description.toLowerCase().includes("string")) {
      parts.push(schema.description);
    }
    return parts.length ? `string (${parts.join(", ")})` : "string";
  }

  if (schema.type === "number") return "number";
  if (schema.type === "integer") return "integer";
  if (schema.type === "boolean") return "boolean";

  if (schema.type === "array") {
    const itemProto = toCompactPrototype(schema.items || { type: "string" });
    return [itemProto];
  }

  if (schema.type === "object" || schema.properties) {
    const res: Record<string, any> = {};
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        res[key] = toCompactPrototype(prop);
      }
    }
    return res;
  }

  return "string";
}

function systemPrompt(options: {
  schema: JsonObject;
  tone?: string | null;
  verbosity?: string | null;
  instructions?: string | null;
}): string {
  const { schema, tone, verbosity, instructions } = options;

  const userInstructions = instructions
    ? `# User Instructions:\n${instructions}`
    : "";
  const toneInstructions = tone
    ? `# Tone Instructions:\nMake slide as ${tone} as possible.`
    : "";

  let verbosityInstructions = "";
  if (verbosity) {
    verbosityInstructions = "# Content Depth Instructions:\n";
    if (verbosity === "concise") {
      verbosityInstructions +=
        "SHORT depth: keep the slide to 2-3 focused sentences or bullets. Headline plus concrete essentials only, no filler.";
    } else if (verbosity === "standard") {
      verbosityInstructions +=
        "MEDIUM depth: provide comprehensive, deep analysis with 4-5 well-rounded points or detailed cards. Every item must feature a bold concept or metric with rich supporting explanations, real data, and business implications.";
    } else if (verbosity === "text-heavy") {
      verbosityInstructions +=
        "ELABORATE depth: deliver exhaustive analytical depth with 5-7 detailed points or 3-4 multi-sentence paragraphs. Include concrete facts, metrics, comparisons, examples, and strategic takeaways. Fill the slide meaningfully and avoid generic high-level statements.";
    }
  }

  const compactSchema = toCompactPrototype(schema);

  return SLIDE_CONTENT_SYSTEM_PROMPT.replace(
    "{user_instructions}",
    userInstructions,
  )
    .replace("{tone_instructions}", toneInstructions)
    .replace("{verbosity_instructions}", verbosityInstructions)
    .replace(
      "{output_fields_instructions}",
      JSON.stringify(compactSchema),
    )
    .replace(/\{user_instructions\}|\{tone_instructions\}|\{verbosity_instructions\}|\{output_fields_instructions\}/g, "");
}

function userPrompt(content: string, language?: string | null, slideNumber?: number | null) {
  const slideNumberSection =
    slideNumber == null ? "" : `Slide ${slideNumber}${language ? ` (Language: ${language})` : ""}\n`;
  return SLIDE_CONTENT_USER_PROMPT.replace(
    "{slide_number_section}",
    slideNumberSection,
  ).replace("{content}", content);
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

function schemaViolations(schema: any, value: any, path = "root"): string[] {
  if (!isRecord(schema)) return [];
  const violations: string[] = [];

  const type = schema.type;
  const typeList = Array.isArray(type) ? type : type ? [type] : [];
  if (typeList.length) {
    const matches = typeList.some((candidate: string) => {
      if (candidate === "object") return isRecord(value);
      if (candidate === "array") return Array.isArray(value);
      if (candidate === "string") return typeof value === "string";
      if (candidate === "number") return typeof value === "number";
      if (candidate === "integer") return Number.isInteger(value);
      if (candidate === "boolean") return typeof value === "boolean";
      if (candidate === "null") return value === null;
      return true;
    });
    if (!matches) {
      violations.push(`${path}: expected ${typeList.join(" or ")}`);
      return violations;
    }
  }

  if (typeof schema.const === "string" && value !== schema.const) {
    violations.push(`${path}: must equal "${schema.const}"`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    violations.push(`${path}: must be one of ${schema.enum.join(", ")}`);
  }

  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      violations.push(
        `${path}: too short (${value.length} chars, minimum ${schema.minLength})`,
      );
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      violations.push(
        `${path}: too long (${value.length} chars, maximum ${schema.maxLength})`,
      );
    }
  }

  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      violations.push(`${path}: must be >= ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      violations.push(`${path}: must be <= ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      violations.push(
        `${path}: needs at least ${schema.minItems} items (got ${value.length})`,
      );
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      violations.push(
        `${path}: allows at most ${schema.maxItems} items (got ${value.length})`,
      );
    }
    if (isRecord(schema.items)) {
      value.forEach((item, index) => {
        violations.push(...schemaViolations(schema.items, item, `${path}[${index}]`));
      });
    }
  }

  if (isRecord(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in value)) violations.push(`${path}.${key}: is required`);
      }
    }
    const properties = isRecord(schema.properties) ? schema.properties : null;
    if (properties) {
      for (const [key, nestedSchema] of Object.entries(properties)) {
        if (key in value) {
          violations.push(
            ...schemaViolations(nestedSchema, value[key], `${path}.${key}`),
          );
        }
      }
    }
  }

  return violations;
}

function stripCodeFences(text: string): string {
  return text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
}

// Length deviations are cosmetic: the slide still renders, so retrying only
// burns TPM budget. Structural problems (types, enums, missing fields) still
// get one repair attempt.
function isLengthViolation(violation: string): boolean {
  return /: (too short|too long) \(|: needs at least |: allows at most /.test(
    violation,
  );
}

export interface SlideContentUsage {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
}

export async function generateSlideContent(options: {
  slideLayout: TemplateLayoutEntry;
  outlineContent: string;
  language?: string | null;
  tone?: string | null;
  verbosity?: string | null;
  instructions?: string | null;
  slideNumber: number;
  slideId?: string;
  /** Epoch ms after which provider retries stop and the slide falls back. */
  retryDeadlineMs?: number;
  onRetry?: (info: LLMRetryInfo) => void;
  onUsage?: (usage: SlideContentUsage) => void;
  onDiagnostics?: (diagnostics: RepairDiagnostics) => void;
}): Promise<Dict> {
  const {
    slideLayout,
    outlineContent,
    language,
    tone,
    verbosity,
    instructions,
    slideNumber,
    slideId,
    retryDeadlineMs,
    onRetry,
    onUsage,
    onDiagnostics,
  } = options;

  const schema = prepareResponseSchema(slideLayout.json_schema);
  if (!schema) return {};

  const messages: LLMMessage[] = [
    {
      role: "system" as const,
      content: systemPrompt({ schema, tone, verbosity, instructions }),
    },
    {
      role: "user" as const,
      content: userPrompt(outlineContent, language, slideNumber),
    },
  ];

  let initialUsage: SlideContentUsage | undefined;
  let finalUsage: SlideContentUsage | undefined;
  let exceptionalRetryRequired = false;

  // Attempt 1: Standard generation
  try {
    const result = await callLLMChatCompletion(messages, {
      temperature: 0.4,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      retryDeadlineMs,
      onRetry,
    });

    if (result.usage) {
      initialUsage = {
        model: result.model,
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
      };
      finalUsage = initialUsage;
      onUsage?.(initialUsage);
    }

    const rawText = stripCodeFences(result.text);
    const parsed = parseJsonWithRepair(rawText);

    // Assess whether response is fundamentally unusable (severe corruption, unparseable, 0 matching props)
    const unusableAssessment = assessFundamentallyUnusable(rawText, parsed, schema);

    if (!unusableAssessment.isUnusable && parsed) {
      // Execute 3-Level Deterministic Recovery Pipeline locally
      const repairResult = executeSchemaRepairPipeline({
        schema,
        generatedJson: parsed,
        outlineContent,
        slideNumber,
        slideId,
        initialUsage,
        isExceptionalRetry: false,
      });

      console.info(
        `[schema-repair] slide ${slideNumber} (${slideLayout.id}): passedValidation=${repairResult.passedValidation}, operations=${repairResult.diagnostics.repairOperations.length}, reconstructed=${repairResult.diagnostics.reconstructedFields.length}, removed=${repairResult.diagnostics.removedElements.length}, source=${repairResult.diagnostics.finalGenerationSource}`,
      );

      if (repairResult.passedValidation) {
        onDiagnostics?.(repairResult.diagnostics);
        return repairResult.content;
      }
    } else {
      console.warn(
        `[schema-repair] slide ${slideNumber} generated fundamentally unusable response: ${unusableAssessment.reason}`,
      );
    }

    // Only if fundamentally unusable or local repair could not produce a valid schema compliant slide,
    // consider a single bounded exceptional retry if within retry deadline.
    const now = Date.now();
    const canRetry = !retryDeadlineMs || now + 3000 < retryDeadlineMs;

    if (canRetry) {
      exceptionalRetryRequired = true;
      console.warn(
        `[schema-repair] initiating exceptional LLM retry for slide ${slideNumber} (${slideLayout.id})`,
      );

      if (parsed) {
        messages.push({
          role: "assistant" as const,
          content: JSON.stringify(parsed),
        });
        const currentViolations = validateSchema(schema, parsed);
        messages.push({
          role: "user" as const,
          content: `The previous response did not satisfy the schema. Fix the structure and return the corrected JSON object only:\n- ${currentViolations
            .slice(0, 10)
            .join("\n- ")}`,
        });
      }

      const retryResult = await callLLMChatCompletion(messages, {
        temperature: 0.2,
        max_tokens: 6144,
        response_format: { type: "json_object" },
        retryDeadlineMs,
        onRetry,
      });

      if (retryResult.usage) {
        finalUsage = {
          model: retryResult.model,
          prompt_tokens: (initialUsage?.prompt_tokens ?? 0) + retryResult.usage.prompt_tokens,
          completion_tokens: (initialUsage?.completion_tokens ?? 0) + retryResult.usage.completion_tokens,
        };
        onUsage?.({
          model: retryResult.model,
          prompt_tokens: retryResult.usage.prompt_tokens,
          completion_tokens: retryResult.usage.completion_tokens,
        });
      }

      const retryParsed = parseJsonWithRepair(stripCodeFences(retryResult.text));
      if (retryParsed) {
        const retryRepairResult = executeSchemaRepairPipeline({
          schema,
          generatedJson: retryParsed,
          outlineContent,
          slideNumber,
          slideId,
          initialUsage: finalUsage,
          isExceptionalRetry: true,
        });

        console.info(
          `[schema-repair] slide ${slideNumber} exceptional retry: passedValidation=${retryRepairResult.passedValidation}, operations=${retryRepairResult.diagnostics.repairOperations.length}, source=${retryRepairResult.diagnostics.finalGenerationSource}`,
        );

        if (retryRepairResult.passedValidation) {
          onDiagnostics?.(retryRepairResult.diagnostics);
          return retryRepairResult.content;
        }
      }
    }
  } catch (err) {
    console.warn(
      `[schema-repair] slide ${slideNumber} LLM completion error:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  // Fallback path: outline-based fallback preserving subject matter
  console.info(
    `[schema-repair] slide ${slideNumber} (${slideLayout.id}) using outline-based fallback`,
  );
  const fallback = buildFallbackContent(schema, outlineContent);
  const fallbackDiagnostics: RepairDiagnostics = {
    slideId,
    slideIndex: slideNumber - 1,
    originalViolations: ["LLM generation unavailable or unusable"],
    repairOperations: [
      {
        level: 2,
        type: "outline_fallback_synthesis",
        path: "root",
        description: "Synthesized complete schema-compliant slide content from approved outline",
      },
    ],
    reconstructedFields: Object.keys(fallback),
    removedElements: [],
    finalValidationPassed: true,
    exceptionalRetryRequired,
    finalGenerationSource: "outline_fallback",
    tokenUsage: {
      initialPromptTokens: initialUsage?.prompt_tokens,
      initialCompletionTokens: initialUsage?.completion_tokens,
      finalPromptTokens: finalUsage?.prompt_tokens,
      finalCompletionTokens: finalUsage?.completion_tokens,
      estimatedTokensSaved: 0,
    },
  };
  onDiagnostics?.(fallbackDiagnostics);
  return fallback;
}

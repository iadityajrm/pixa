// Automatic Schema Repair & Content Recovery System for V3 Presentation Generation Engine.
// Provides a 3-level deterministic recovery mechanism that prioritizes preserving valid AI-generated content
// while ensuring every slide ultimately conforms to its original layout schema without unnecessary LLM retries.

import type { JsonObject } from "./types";

export interface RepairOperation {
  level: 1 | 2 | 3;
  type: string;
  path: string;
  description: string;
  details?: Record<string, any>;
}

export interface RepairDiagnostics {
  slideId?: string;
  slideIndex: number;
  originalViolations: string[];
  repairOperations: RepairOperation[];
  reconstructedFields: string[];
  removedElements: string[];
  finalValidationPassed: boolean;
  remainingViolations?: string[];
  exceptionalRetryRequired: boolean;
  finalGenerationSource:
    | "ai_generated_clean"
    | "ai_generated_repaired"
    | "exceptional_retry_clean"
    | "exceptional_retry_repaired"
    | "outline_fallback";
  tokenUsage?: {
    initialPromptTokens?: number;
    initialCompletionTokens?: number;
    finalPromptTokens?: number;
    finalCompletionTokens?: number;
    estimatedTokensSaved?: number;
  };
}

export interface ParsedOutline {
  raw: string;
  heading: string;
  body: string;
  bullets: string[];
  sentences: string[];
  metrics: Array<{ value: number; unit?: string; label: string; raw: string }>;
  keyValues: Record<string, string>;
}

export interface UnusableAssessment {
  isUnusable: boolean;
  reason?: string;
  score: number;
}

type Dict = Record<string, any>;

function isRecord(value: unknown): value is Dict {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Outline Parsing
// ---------------------------------------------------------------------------

export function outlineHeading(outline: string): string {
  const match = outline.match(/^\s{0,3}#{1,6}\s*(.+)$/m);
  if (match) {
    // Strip leading "Slide X: " if present
    return match[1].replace(/^Slide\s+\d+\s*:\s*/i, "").trim();
  }
  return "";
}

export function outlineBody(outline: string): string {
  return outline
    .replace(/^\s{0,3}#{1,6}.*$/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseOutline(outline: string): ParsedOutline {
  const heading = outlineHeading(outline) || "Slide overview";
  const body = outlineBody(outline) || heading;

  const rawLines = outline.split("\n");
  const bullets: string[] = [];
  const keyValues: Record<string, string> = {};
  const metrics: Array<{ value: number; unit?: string; label: string; raw: string }> = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const bulletMatch = line.match(/^[-*•]\s*(.+)$/);
    const text = bulletMatch ? bulletMatch[1].trim() : line;
    if (text) {
      bullets.push(text);

      const kvMatch = text.match(/^([^:]+):\s*(.+)$/);
      if (kvMatch) {
        const k = kvMatch[1].trim().toLowerCase();
        const v = kvMatch[2].trim();
        keyValues[k] = v;
      }

      // Check for metrics (e.g., "$10M", "150%", "45,000", "99.9%")
      const metricMatch = text.match(/([$€£¥]?\s*[\d,.]+(?:\.\d+)?\s*[%kKmMbBtT]?)/);
      if (metricMatch) {
        const rawMetric = metricMatch[1].trim();
        const numClean = rawMetric.replace(/[$€£¥,]/g, "");
        const numVal = parseFloat(numClean);
        if (!isNaN(numVal)) {
          metrics.push({
            value: numVal,
            raw: rawMetric,
            label: text.replace(rawMetric, "").replace(/^[:\-–\s]+|[:\-–\s]+$/g, "").trim(),
          });
        }
      }
    }
  }

  // Split body into sentences
  const sentences = body
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    raw: outline,
    heading,
    body,
    bullets,
    sentences,
    metrics,
    keyValues,
  };
}

// ---------------------------------------------------------------------------
// Strict Schema Validation
// ---------------------------------------------------------------------------

export function validateSchema(schema: any, value: any, path = "root"): string[] {
  if (!isRecord(schema)) return [];
  const violations: string[] = [];

  const type = schema.type;
  const typeList = Array.isArray(type) ? type : type ? [type] : [];
  if (typeList.length) {
    const matches = typeList.some((candidate: string) => {
      if (candidate === "object") return isRecord(value);
      if (candidate === "array") return Array.isArray(value);
      if (candidate === "string") return typeof value === "string";
      if (candidate === "number") return typeof value === "number" && !isNaN(value);
      if (candidate === "integer") return Number.isInteger(value);
      if (candidate === "boolean") return typeof value === "boolean";
      if (candidate === "null") return value === null;
      return true;
    });
    if (!matches) {
      violations.push(`${path}: expected ${typeList.join(" or ")}, got ${typeof value}`);
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
        violations.push(...validateSchema(schema.items, item, `${path}[${index}]`));
      });
    }
  }

  if (isRecord(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in value) || value[key] === undefined) {
          violations.push(`${path}.${key}: is required`);
        }
      }
    }
    const properties = isRecord(schema.properties) ? schema.properties : null;
    if (properties) {
      for (const [key, nestedSchema] of Object.entries(properties)) {
        if (key in value && value[key] !== undefined) {
          violations.push(
            ...validateSchema(nestedSchema, value[key], `${path}.${key}`),
          );
        }
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Assessment: Fundamentally Unusable Detection
// ---------------------------------------------------------------------------

export function assessFundamentallyUnusable(
  rawText: string,
  parsed: Dict | null,
  schema: Dict,
): UnusableAssessment {
  if (!parsed || !isRecord(parsed)) {
    return {
      isUnusable: true,
      reason: "Model output could not be parsed as a JSON object",
      score: 100,
    };
  }

  const topKeys = Object.keys(parsed);
  if (topKeys.length === 0) {
    return {
      isUnusable: true,
      reason: "Model output is an empty JSON object",
      score: 100,
    };
  }

  // Count how many top-level required properties exist
  const requiredTop = Array.isArray(schema.required)
    ? schema.required.filter((k: string) => k !== "__speaker_note__")
    : [];

  const matchedRequired = requiredTop.filter((k: string) => k in parsed);
  if (requiredTop.length > 0 && matchedRequired.length === 0) {
    // None of the top-level required properties are present
    // Check if the model wrapped everything in a single wrapper key
    const candidateWrappers = topKeys.filter(
      (k) => isRecord(parsed[k]) || Array.isArray(parsed[k]),
    );
    let wrappedFound = false;
    for (const w of candidateWrappers) {
      if (isRecord(parsed[w])) {
        const subKeys = Object.keys(parsed[w]);
        if (requiredTop.some((k) => subKeys.includes(k))) {
          wrappedFound = true;
          break;
        }
      }
    }
    if (!wrappedFound) {
      return {
        isUnusable: true,
        reason: "Model generated completely unaligned JSON with no matching top-level properties",
        score: 95,
      };
    }
  }

  // Check for severe repetition loops or truncated gibberish
  if (rawText.length > 500 && /(.)\1{40,}/.test(rawText)) {
    return {
      isUnusable: true,
      reason: "Model generated repetitive loop/degenerate text",
      score: 90,
    };
  }

  return {
    isUnusable: false,
    score: 0,
  };
}

// ---------------------------------------------------------------------------
// Robust JSON Parsing with Automatic Cleanup
// ---------------------------------------------------------------------------

export function parseJsonWithRepair(text: string): Dict | null {
  if (!text || typeof text !== "string") return null;

  const cleaned = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  // Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (isRecord(parsed)) return parsed;
  } catch {}

  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  // 1. If balanced curly braces exist, try parsing that slice first
  const end = cleaned.lastIndexOf("}");
  if (end > start) {
    const candidate = cleaned.slice(start, end + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (isRecord(parsed)) return parsed;
    } catch {}

    // Remove trailing commas before } or ]
    let repaired = candidate.replace(/,\s*([}\]])/g, "$1");
    try {
      const parsed = JSON.parse(repaired);
      if (isRecord(parsed)) return parsed;
    } catch {}

    // Fix unescaped control chars / newlines within strings
    repaired = repaired.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, "\\n");
    try {
      const parsed = JSON.parse(repaired);
      if (isRecord(parsed)) return parsed;
    } catch {}
  }

  // 2. If parsing the slice failed or response is truncated (missing closing brackets/braces)
  let candidate = cleaned.slice(start);
  let repaired = candidate.replace(/,\s*([}\]])/g, "$1");
  repaired = repaired.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, "\\n");

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") openBraces++;
      else if (ch === "}") openBraces = Math.max(0, openBraces - 1);
      else if (ch === "[") openBrackets++;
      else if (ch === "]") openBrackets = Math.max(0, openBrackets - 1);
    }
  }

  if (inString) repaired += '"';
  repaired = repaired.trimEnd().replace(/,\s*$/, "");
  while (openBrackets > 0) {
    repaired += "]";
    openBrackets--;
  }
  while (openBraces > 0) {
    repaired += "}";
    openBraces--;
  }

  try {
    const parsed = JSON.parse(repaired);
    if (isRecord(parsed)) return parsed;
  } catch {}

  return null;
}

// ---------------------------------------------------------------------------
// Level 1: Automatic Structural Repair
// ---------------------------------------------------------------------------

function normalizeEnumValue(candidate: unknown, allowedEnums: any[]): any {
  if (allowedEnums.includes(candidate)) return candidate;
  if (typeof candidate === "string") {
    const clean = candidate.trim().toLowerCase().replace(/[-\s]+/g, "_");
    if (allowedEnums.includes(clean)) return clean;
    // Substring match
    for (const item of allowedEnums) {
      if (typeof item === "string" && (clean.includes(item) || item.includes(clean))) {
        return item;
      }
    }
    // Specific chart type mappings
    if (clean.includes("column")) return "bar";
    if (clean.includes("doughnut")) return "donut";
    if (clean.includes("spline") || clean.includes("trend")) return "line";
  }
  return null;
}

function safeCoerce(val: any, targetType: string): any {
  if (val === undefined) return undefined;
  if (targetType === "string") {
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (val === null) return "";
    return undefined;
  }
  if (targetType === "number") {
    if (typeof val === "number") return isNaN(val) ? undefined : val;
    if (typeof val === "string") {
      const cleaned = val.replace(/[$€£¥,]/g, "").trim();
      const n = parseFloat(cleaned);
      if (!isNaN(n)) return n;
    }
    return undefined;
  }
  if (targetType === "integer") {
    if (Number.isInteger(val)) return val;
    if (typeof val === "number") return Math.round(val);
    if (typeof val === "string") {
      const cleaned = val.replace(/[$€£¥,]/g, "").trim();
      const n = parseInt(cleaned, 10);
      if (!isNaN(n)) return n;
    }
    return undefined;
  }
  if (targetType === "boolean") {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const low = val.trim().toLowerCase();
      if (low === "true" || low === "yes" || low === "1") return true;
      if (low === "false" || low === "no" || low === "0") return false;
    }
    return undefined;
  }
  if (targetType === "array") {
    if (Array.isArray(val)) return val;
    if (val !== null && val !== undefined) return [val];
    return undefined;
  }
  if (targetType === "object") {
    if (isRecord(val)) return val;
    return undefined;
  }
  return undefined;
}

export function repairStructuralLevel1(
  schema: Dict,
  data: any,
  operations: RepairOperation[],
  path = "root",
  removedElements?: string[],
): any {
  if (!schema || typeof schema !== "object") return data;

  // Check if root data was wrapped in a single wrapper container
  if (path === "root" && isRecord(data) && isRecord(schema.properties)) {
    const schemaProps = Object.keys(schema.properties);
    const dataKeys = Object.keys(data);
    const matchingCount = dataKeys.filter((k) => schemaProps.includes(k)).length;
    if (matchingCount === 0 && dataKeys.length === 1) {
      const singleKey = dataKeys[0];
      if (isRecord(data[singleKey])) {
        const innerKeys = Object.keys(data[singleKey]);
        const innerMatchCount = innerKeys.filter((k) => schemaProps.includes(k)).length;
        if (innerMatchCount > 0) {
          operations.push({
            level: 1,
            type: "unwrap_container",
            path: `root.${singleKey}`,
            description: `Unwrapped root data from single wrapper key '${singleKey}'`,
          });
          data = data[singleKey];
        }
      }
    }
  }

  const expectedType = schema.type;

  // Handle Object types
  if (expectedType === "object") {
    if (!isRecord(data)) {
      if (typeof data === "string") {
        try {
          const parsed = JSON.parse(data);
          if (isRecord(parsed)) {
            operations.push({
              level: 1,
              type: "parse_nested_json_string",
              path,
              description: `Parsed JSON string into object at ${path}`,
            });
            data = parsed;
          }
        } catch {}
      }
      if (!isRecord(data)) {
        // If data is a string/primitive and schema expects a single-property object with that property name
        if (typeof data === "string" && isRecord(schema.properties)) {
          const propKeys = Object.keys(schema.properties);
          const lastSegment = path.split(".").pop();
          if (lastSegment && propKeys.includes(lastSegment)) {
            operations.push({
              level: 1,
              type: "wrap_primitive_in_object",
              path,
              description: `Wrapped string at ${path} into object { ${lastSegment}: ... }`,
            });
            data = { [lastSegment]: data };
          }
        }
      }
      if (!isRecord(data)) return data;
    }

    const properties = isRecord(schema.properties) ? schema.properties : {};
    const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);
    const result: Dict = {};

    // 1. Process existing keys in data
    for (const [key, rawVal] of Object.entries(data)) {
      if (key in properties) {
        const propSchema = properties[key];
        const isOptional = !required.has(key);
        // If an optional nested object has no valid fields from the model, don't construct an empty one
        if (isOptional && propSchema.type === "object" && isRecord(rawVal)) {
          const nestedKeys = Object.keys(rawVal);
          const expectedNested = isRecord(propSchema.properties) ? Object.keys(propSchema.properties) : [];
          const hasAnyExpected = nestedKeys.some((k) => expectedNested.includes(k));
          if (!hasAnyExpected && nestedKeys.length > 0) {
            operations.push({
              level: 3,
              type: "remove_invalid_optional_property",
              path: `${path}.${key}`,
              description: `Removed empty/invalid optional object '${key}' from ${path}`,
            });
            if (removedElements) removedElements.push(`${path}.${key}`);
            continue;
          }
        }
        result[key] = repairStructuralLevel1(
          propSchema,
          rawVal,
          operations,
          `${path}.${key}`,
          removedElements,
        );
      } else {
        // Unexpected property!
        const matchedPropKey = Object.keys(properties).find(
          (p) =>
            p.toLowerCase().replace(/_/g, "") === key.toLowerCase().replace(/_/g, ""),
        );
        if (matchedPropKey && !(matchedPropKey in result)) {
          operations.push({
            level: 1,
            type: "normalize_property_casing",
            path: `${path}.${key}`,
            description: `Normalized key '${key}' to schema key '${matchedPropKey}'`,
          });
          result[matchedPropKey] = repairStructuralLevel1(
            properties[matchedPropKey],
            rawVal,
            operations,
            `${path}.${matchedPropKey}`,
            removedElements,
          );
        } else {
          // Remove unexpected property
          operations.push({
            level: 1,
            type: "remove_unexpected_property",
            path: `${path}.${key}`,
            description: `Removed unexpected property '${key}' from ${path}`,
          });
          if (removedElements) removedElements.push(`${path}.${key}`);
        }
      }
    }

    // 2. Check for missing properties
    for (const [key, propSchema] of Object.entries(properties)) {
      if (result[key] === undefined) {
        if (typeof propSchema.const === "string") {
          result[key] = propSchema.const;
          operations.push({
            level: 1,
            type: "initialize_const_property",
            path: `${path}.${key}`,
            description: `Initialized const property '${key}' with "${propSchema.const}"`,
          });
          continue;
        }

        // If required object, initialize and recurse
        if (required.has(key) && propSchema.type === "object" && isRecord(propSchema.properties)) {
          result[key] = repairStructuralLevel1(
            propSchema,
            {},
            operations,
            `${path}.${key}`,
            removedElements,
          );
        }
      }
    }

    return result;
  }

  // Handle Array types
  if (expectedType === "array") {
    let arr: any[];
    if (Array.isArray(data)) {
      arr = data;
    } else if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          operations.push({
            level: 1,
            type: "parse_nested_json_array",
            path,
            description: `Parsed JSON string into array at ${path}`,
          });
          arr = parsed;
        } else {
          arr = [data];
        }
      } catch {
        arr = [data];
      }
    } else if (data !== undefined && data !== null) {
      arr = [data];
    } else {
      arr = [];
    }

    const itemSchema = isRecord(schema.items) ? schema.items : null;
    let repairedItems = itemSchema
      ? arr.map((item, idx) =>
          repairStructuralLevel1(itemSchema, item, operations, `${path}[${idx}]`, removedElements),
        )
      : arr;

    repairedItems = repairedItems.filter((item) => item !== undefined && item !== null);

    // Enforce maxItems
    if (typeof schema.maxItems === "number" && repairedItems.length > schema.maxItems) {
      const removedCount = repairedItems.length - schema.maxItems;
      repairedItems = repairedItems.slice(0, schema.maxItems);
      operations.push({
        level: 1,
        type: "enforce_max_items",
        path,
        description: `Truncated array from ${repairedItems.length + removedCount} to maxItems ${schema.maxItems}`,
      });
    }

    return repairedItems;
  }

  // Handle Enum / Const
  if (schema.const !== undefined) {
    if (data !== schema.const) {
      operations.push({
        level: 1,
        type: "correct_const_value",
        path,
        description: `Set const property at ${path} to "${schema.const}"`,
      });
      return schema.const;
    }
  }

  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(data)) {
      const normalized = normalizeEnumValue(data, schema.enum);
      if (normalized !== null) {
        operations.push({
          level: 1,
          type: "normalize_enum_value",
          path,
          description: `Corrected enum value at ${path} from "${data}" to "${normalized}"`,
        });
        return normalized;
      }
      if (schema.enum.length > 0) {
        const fallback = schema.enum[0];
        operations.push({
          level: 1,
          type: "fallback_enum_value",
          path,
          description: `Reset invalid enum at ${path} to allowed option "${fallback}"`,
        });
        return fallback;
      }
    }
    return data;
  }

  // Handle Type coercion (string, number, integer, boolean)
  if (typeof expectedType === "string") {
    const coerced = safeCoerce(data, expectedType);
    if (coerced !== undefined && coerced !== data) {
      operations.push({
        level: 1,
        type: "coerce_data_type",
        path,
        description: `Coerced type of ${path} from ${typeof data} to ${expectedType}`,
      });
      data = coerced;
    }
  }

  // String length boundary adjustments
  if (typeof data === "string") {
    if (typeof schema.maxLength === "number" && data.length > schema.maxLength) {
      const originalLen = data.length;
      // Complete sentence preservation: if sentence naturally terminates within soft limit, keep it
      const softMax = Math.min(data.length, Math.floor(schema.maxLength * 1.15));
      const candidate = data.slice(0, softMax);
      const sentenceEnd = Math.max(
        candidate.lastIndexOf("."),
        candidate.lastIndexOf(";"),
        candidate.lastIndexOf("!"),
        candidate.lastIndexOf("?"),
      );

      let trimmed = "";
      if (sentenceEnd >= Math.floor(schema.maxLength * 0.7)) {
        trimmed = candidate.slice(0, sentenceEnd + 1).trim();
      } else {
        const sliced = data.slice(0, schema.maxLength);
        const lastSpace = sliced.lastIndexOf(" ");
        if (lastSpace > schema.maxLength * 0.6) {
          trimmed = sliced.slice(0, lastSpace).trim();
        } else {
          trimmed = sliced.trim();
        }
      }

      operations.push({
        level: 1,
        type: "trim_string_length",
        path,
        description: `Trimmed string at ${path} from ${originalLen} to ${trimmed.length} chars (maxLength ${schema.maxLength})`,
      });
      data = trimmed;
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// Level 2: Outline-Aware Content Reconstruction
// ---------------------------------------------------------------------------

function fitStringToSchema(
  str: string,
  schema: Dict,
  fallbackContext = "",
): string {
  let res = str.trim();
  if (typeof schema.maxLength === "number" && res.length > schema.maxLength) {
    // Preserve whole thoughts and sentence endings rather than punishing with abrupt cuts
    const softMax = Math.min(res.length, Math.floor(schema.maxLength * 1.15));
    const candidate = res.slice(0, softMax);
    const sentenceEnd = Math.max(
      candidate.lastIndexOf("."),
      candidate.lastIndexOf(";"),
      candidate.lastIndexOf("!"),
      candidate.lastIndexOf("?"),
    );

    if (sentenceEnd >= Math.floor(schema.maxLength * 0.7)) {
      res = candidate.slice(0, sentenceEnd + 1).trim();
    } else {
      const sliced = res.slice(0, schema.maxLength);
      const lastSpace = sliced.lastIndexOf(" ");
      if (lastSpace > schema.maxLength * 0.6) {
        res = sliced.slice(0, lastSpace).trim();
      } else {
        res = sliced.trim();
      }
    }
  }
  if (typeof schema.minLength === "number" && res.length < schema.minLength) {
    if (fallbackContext) {
      let extra = fallbackContext.trim();
      while (res.length < schema.minLength) {
        res += " " + extra;
      }
      if (typeof schema.maxLength === "number" && res.length > schema.maxLength) {
        res = res.slice(0, schema.maxLength).trimEnd();
      }
    }
    if (res.length < schema.minLength) {
      res = res.padEnd(schema.minLength, ".");
    }
  }
  return res;
}

function extractMeaningfulStringFromOutline(
  outline: ParsedOutline,
  propKey: string,
  schema: Dict,
): string | null {
  if (propKey === "__speaker_note__") {
    return fitStringToSchema(outline.body, schema, outline.heading);
  }

  const isTitle = /title|heading|headline|name/i.test(propKey);
  const isCaption = /caption|description|summary|paragraph|body|note|text/i.test(propKey);
  const isMetric = /metric|stat|value|number|percent|kpi/i.test(propKey);

  if (isTitle && outline.heading) {
    return fitStringToSchema(outline.heading, schema, outline.body);
  }

  if (isCaption) {
    const candidate = outline.bullets[0] || outline.body;
    if (candidate) {
      return fitStringToSchema(candidate, schema, outline.body);
    }
  }

  if (isMetric && outline.metrics.length > 0) {
    return fitStringToSchema(outline.metrics[0].raw, schema, outline.bullets[0]);
  }

  // Match keyValues
  const cleanKey = propKey.toLowerCase().replace(/_/g, "");
  for (const [k, v] of Object.entries(outline.keyValues)) {
    if (cleanKey.includes(k.replace(/_/g, "")) || k.replace(/_/g, "").includes(cleanKey)) {
      return fitStringToSchema(v, schema, outline.body);
    }
  }

  const genericCandidate = outline.bullets[0] || outline.body || outline.heading;
  if (genericCandidate) {
    return fitStringToSchema(genericCandidate, schema, outline.body);
  }

  return null;
}

function constructObjectFromOutline(
  schema: Dict,
  outline: ParsedOutline,
  itemIndex: number,
  operations: RepairOperation[],
  reconstructedFields: string[],
  path: string,
): Dict | null {
  if (!isRecord(schema.properties)) return null;

  const result: Dict = {};
  const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);

  // Determine bullet or metric slice for this itemIndex
  const hasExactBullet = itemIndex < outline.bullets.length;
  const bullet = hasExactBullet
    ? outline.bullets[itemIndex]
    : itemIndex < outline.sentences.length
    ? outline.sentences[itemIndex]
    : outline.bullets[itemIndex % Math.max(1, outline.bullets.length)] || outline.body;

  const sentence = itemIndex < outline.sentences.length
    ? outline.sentences[itemIndex]
    : outline.sentences[itemIndex % Math.max(1, outline.sentences.length)] || outline.body;

  const metric = itemIndex < outline.metrics.length
    ? outline.metrics[itemIndex]
    : undefined;

  // Special handling for chart objects
  if (schema.properties.chart_type) {
    result.chart_type = schema.properties.chart_type.enum?.[0] || "bar";
    if (schema.properties.title) {
      result.title = fitStringToSchema(outline.heading, schema.properties.title, outline.body);
    }
    const categories: string[] = [];
    const catMin = Math.max(1, schema.properties.categories?.minItems || 3);
    for (let c = 0; c < catMin; c++) {
      const catText = (outline.bullets[c] ? outline.bullets[c].split(/[:\-–]/)[0] : `Category ${c + 1}`).trim();
      categories.push(catText);
    }
    result.categories = categories;

    const values = categories.map((_, idx) => outline.metrics[idx]?.value || (idx + 1) * 25);
    result.series = [
      {
        name: fitStringToSchema(outline.heading, { maxLength: 30 }, "Series"),
        values,
      },
    ];
    reconstructedFields.push(path);
    return result;
  }

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (key === "__speaker_note__") continue;
    if (/^__(?:image|icon)_url__$|^__/.test(key)) continue;

    // Check if property is const
    if (propSchema.const !== undefined) {
      result[key] = propSchema.const;
      reconstructedFields.push(`${path}.${key}`);
      continue;
    }

    if (propSchema.type === "string") {
      let strVal: string | null = null;
      if (/title|heading|headline|name/i.test(key)) {
        const kvMatch = bullet ? bullet.match(/^([^:]+):\s*(.+)$/) : null;
        strVal = kvMatch ? kvMatch[1].trim() : outline.bullets[itemIndex] || outline.heading;
      } else if (/caption|description|summary|body|text|paragraph/i.test(key)) {
        const kvMatch = bullet ? bullet.match(/^([^:]+):\s*(.+)$/) : null;
        strVal = kvMatch ? kvMatch[2].trim() : bullet || sentence;
      } else if (/metric|stat|value/i.test(key)) {
        strVal = metric ? metric.raw : bullet;
      } else if (/label/i.test(key)) {
        strVal = metric ? metric.label : bullet.split(/[:\-–]/)[0].trim();
      } else if (/image_prompt|icon_query/i.test(key)) {
        strVal = outline.heading || "presentation visual";
      }

      if (!strVal && required.has(key)) {
        strVal = bullet || outline.heading;
      }

      if (strVal) {
        strVal = fitStringToSchema(strVal, propSchema, sentence || outline.body);
        result[key] = strVal;
        reconstructedFields.push(`${path}.${key}`);
      }
    } else if (propSchema.type === "number" || propSchema.type === "integer") {
      if (metric) {
        result[key] = metric.value;
        reconstructedFields.push(`${path}.${key}`);
      } else if (required.has(key)) {
        result[key] = 0;
      }
    } else if (propSchema.type === "object") {
      const nested = constructObjectFromOutline(
        propSchema,
        outline,
        itemIndex,
        operations,
        reconstructedFields,
        `${path}.${key}`,
      );
      if (nested) result[key] = nested;
    } else if (propSchema.type === "array") {
      const minItems = typeof propSchema.minItems === "number" ? propSchema.minItems : 1;
      const subItemsSchema = isRecord(propSchema.items) ? propSchema.items : null;
      if (subItemsSchema) {
        const arr: any[] = [];
        for (let i = 0; i < minItems; i++) {
          if (subItemsSchema.type === "object") {
            const nested = constructObjectFromOutline(
              subItemsSchema,
              outline,
              i,
              operations,
              reconstructedFields,
              `${path}.${key}[${i}]`,
            );
            if (nested) arr.push(nested);
          } else if (subItemsSchema.type === "string") {
            const itemText = outline.bullets[i] || outline.bullets[0] || outline.heading;
            arr.push(fitStringToSchema(itemText, subItemsSchema, outline.body));
          } else if (subItemsSchema.type === "array" && isRecord(subItemsSchema.items)) {
            const rowMin = typeof subItemsSchema.minItems === "number" ? subItemsSchema.minItems : 2;
            const row: any[] = [];
            for (let c = 0; c < rowMin; c++) {
              const cell = (c === 0 ? outline.bullets[i] : outline.metrics[i]?.raw) || "Data";
              row.push(fitStringToSchema(cell, subItemsSchema.items, outline.body));
            }
            arr.push(row);
          }
        }
        result[key] = arr;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function reconstructContentLevel2(
  schema: Dict,
  data: any,
  outline: ParsedOutline,
  operations: RepairOperation[],
  reconstructedFields: string[],
  path = "root",
): any {
  if (!schema || typeof schema !== "object" || data === undefined || data === null) return data;

  const expectedType = schema.type;

  // 1. Objects
  if (expectedType === "object" && isRecord(schema.properties)) {
    if (!isRecord(data)) return data;

    const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const fieldPath = `${path}.${key}`;
      const currentVal = data[key];

      // Const enforcement
      if (propSchema.const !== undefined && currentVal !== propSchema.const) {
        data[key] = propSchema.const;
        reconstructedFields.push(fieldPath);
        operations.push({
          level: 2,
          type: "enforce_const_value",
          path: fieldPath,
          description: `Enforced required const value "${propSchema.const}" on ${key}`,
        });
        continue;
      }

      // If required field is missing, null, empty string, or an empty object where schema expects properties
      const isEmptyObject = isRecord(currentVal) && Object.keys(currentVal).length === 0 && isRecord(propSchema.properties) && Object.keys(propSchema.properties).length > 0;
      if (required.has(key) && (currentVal === undefined || currentVal === null || currentVal === "" || isEmptyObject)) {
        if (propSchema.type === "string") {
          const recovered = extractMeaningfulStringFromOutline(outline, key, propSchema);
          if (recovered) {
            data[key] = recovered;
            reconstructedFields.push(fieldPath);
            operations.push({
              level: 2,
              type: "reconstruct_string_from_outline",
              path: fieldPath,
              description: `Reconstructed missing required string '${key}' from outline`,
            });
          }
        } else if (propSchema.type === "object") {
          const nested = constructObjectFromOutline(
            propSchema,
            outline,
            0,
            operations,
            reconstructedFields,
            fieldPath,
          );
          if (nested) {
            data[key] = nested;
            reconstructedFields.push(fieldPath);
            operations.push({
              level: 2,
              type: "reconstruct_object_from_outline",
              path: fieldPath,
              description: `Reconstructed missing required object '${key}' from outline`,
            });
          }
        } else if (propSchema.type === "array") {
          const minItems = typeof propSchema.minItems === "number" ? propSchema.minItems : 1;
          const itemSchema = isRecord(propSchema.items) ? propSchema.items : null;
          const arr: any[] = [];
          if (itemSchema) {
            for (let i = 0; i < minItems; i++) {
              if (itemSchema.type === "object") {
                const nested = constructObjectFromOutline(
                  itemSchema,
                  outline,
                  i,
                  operations,
                  reconstructedFields,
                  `${fieldPath}[${i}]`,
                );
                if (nested) arr.push(nested);
              } else if (itemSchema.type === "string") {
                const itemText = outline.bullets[i] || outline.bullets[0] || outline.heading;
                arr.push(fitStringToSchema(itemText, itemSchema, outline.body));
              } else if (itemSchema.type === "array" && isRecord(itemSchema.items)) {
                const rowMin = typeof itemSchema.minItems === "number" ? itemSchema.minItems : 2;
                const row: any[] = [];
                for (let c = 0; c < rowMin; c++) {
                  const cell = (c === 0 ? outline.bullets[i] : outline.metrics[i]?.raw) || "Data";
                  row.push(fitStringToSchema(cell, itemSchema.items, outline.body));
                }
                arr.push(row);
              }
            }
          }
          data[key] = arr;
          operations.push({
            level: 2,
            type: "initialize_missing_required_array",
            path: fieldPath,
            description: `Initialized missing required array '${key}' with reconstructed items`,
          });
        }
      }

      // Recurse into existing property value
      if (data[key] !== undefined && data[key] !== null) {
        data[key] = reconstructContentLevel2(
          propSchema,
          data[key],
          outline,
          operations,
          reconstructedFields,
          fieldPath,
        );
      }
    }
  }

  // 2. Arrays: Enforce minItems using Outline reconstruction
  if (expectedType === "array" && Array.isArray(data)) {
    const minItems = typeof schema.minItems === "number" ? schema.minItems : 0;
    const itemSchema = isRecord(schema.items) ? schema.items : null;

    if (data.length < minItems && itemSchema) {
      const missingCount = minItems - data.length;
      for (let i = 0; i < missingCount; i++) {
        const itemIdx = data.length;
        const itemPath = `${path}[${itemIdx}]`;

        if (itemSchema.type === "object") {
          const newItem = constructObjectFromOutline(
            itemSchema,
            outline,
            itemIdx,
            operations,
            reconstructedFields,
            itemPath,
          );
          if (newItem) {
            data.push(newItem);
            reconstructedFields.push(itemPath);
            operations.push({
              level: 2,
              type: "reconstruct_array_card_from_outline",
              path: itemPath,
              description: `Reconstructed missing array card ${itemIdx + 1}/${minItems} from outline`,
            });
          }
        } else if (itemSchema.type === "string") {
          const bullet = outline.bullets[itemIdx] || outline.bullets[0] || outline.heading;
          const text = fitStringToSchema(bullet, itemSchema, outline.body);
          data.push(text);
          reconstructedFields.push(itemPath);
          operations.push({
            level: 2,
            type: "reconstruct_array_item_from_outline",
            path: itemPath,
            description: `Reconstructed missing array string item ${itemIdx + 1}/${minItems} from outline`,
          });
        } else if (itemSchema.type === "array" && isRecord(itemSchema.items)) {
          // Table row reconstruction
          const rowMin = typeof itemSchema.minItems === "number" ? itemSchema.minItems : 2;
          const subItemSchema = itemSchema.items;
          const row: any[] = [];
          for (let c = 0; c < rowMin; c++) {
            const cellText = (c === 0 ? outline.bullets[itemIdx] : outline.metrics[itemIdx]?.raw) || "Data";
            row.push(fitStringToSchema(cellText, subItemSchema, outline.body));
          }
          data.push(row);
          reconstructedFields.push(itemPath);
          operations.push({
            level: 2,
            type: "reconstruct_table_row_from_outline",
            path: itemPath,
            description: `Reconstructed missing table row ${itemIdx + 1}/${minItems} from outline`,
          });
        }
      }
    }

    // Process nested items
    if (itemSchema) {
      for (let idx = 0; idx < data.length; idx++) {
        data[idx] = reconstructContentLevel2(
          itemSchema,
          data[idx],
          outline,
          operations,
          reconstructedFields,
          `${path}[${idx}]`,
        );
      }
    }
  }

  // 3. String minLength satisfaction from Outline
  if (expectedType === "string" && typeof data === "string") {
    if (typeof schema.minLength === "number" && data.length < schema.minLength) {
      const fitted = fitStringToSchema(data, schema, outline.body || outline.heading);
      if (fitted.length >= schema.minLength) {
        operations.push({
          level: 2,
          type: "expand_short_string_from_outline",
          path,
          description: `Expanded short string at ${path} to meet minLength ${schema.minLength}`,
        });
        data = fitted;
        reconstructedFields.push(path);
      }
    }
  }

  // 4. Chart structure synchronization
  if (expectedType === "object" && isRecord(schema.properties) && schema.properties.chart_type) {
    if (isRecord(data) && Array.isArray(data.categories) && Array.isArray(data.series)) {
      const catCount = data.categories.length;
      for (let sIdx = 0; sIdx < data.series.length; sIdx++) {
        const ser = data.series[sIdx];
        if (isRecord(ser) && Array.isArray(ser.values)) {
          if (ser.values.length < catCount) {
            const lastVal = ser.values.length > 0 ? ser.values[ser.values.length - 1] : 10;
            while (ser.values.length < catCount) {
              ser.values.push(lastVal);
            }
            operations.push({
              level: 2,
              type: "pad_chart_series_values",
              path: `${path}.series[${sIdx}].values`,
              description: `Padded chart series values to match ${catCount} categories`,
            });
          } else if (ser.values.length > catCount && catCount > 0) {
            ser.values = ser.values.slice(0, catCount);
            operations.push({
              level: 2,
              type: "trim_chart_series_values",
              path: `${path}.series[${sIdx}].values`,
              description: `Trimmed chart series values to match ${catCount} categories`,
            });
          }
        }
      }
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// Level 3: Selective Removal & Final Schema Validation
// ---------------------------------------------------------------------------

export function selectiveRemovalLevel3(
  schema: Dict,
  data: any,
  operations: RepairOperation[],
  removedElements: string[],
  path = "root",
): any {
  if (!schema || typeof schema !== "object" || data === undefined || data === null) return data;

  const expectedType = schema.type;

  // 1. Objects: prune invalid optional properties
  if (expectedType === "object" && isRecord(schema.properties)) {
    if (!isRecord(data)) return data;

    const properties = schema.properties;
    const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);

    for (const [key, val] of Object.entries(data)) {
      const fieldPath = `${path}.${key}`;
      const propSchema = properties[key];

      if (!propSchema) {
        delete data[key];
        removedElements.push(fieldPath);
        continue;
      }

      const violations = validateSchema(propSchema, val, fieldPath);
      if (violations.length > 0) {
        if (!required.has(key)) {
          delete data[key];
          removedElements.push(fieldPath);
          operations.push({
            level: 3,
            type: "remove_invalid_optional_property",
            path: fieldPath,
            description: `Removed invalid optional property '${key}' (${violations[0]})`,
            details: { violations },
          });
          continue;
        }
      }

      data[key] = selectiveRemovalLevel3(
        propSchema,
        val,
        operations,
        removedElements,
        fieldPath,
      );
    }
  }

  // 2. Arrays: prune invalid items while respecting minItems
  if (expectedType === "array" && Array.isArray(data)) {
    const itemSchema = isRecord(schema.items) ? schema.items : null;
    const minItems = typeof schema.minItems === "number" ? schema.minItems : 0;

    if (itemSchema) {
      const validItems: any[] = [];
      for (let idx = 0; idx < data.length; idx++) {
        const item = data[idx];
        const itemPath = `${path}[${idx}]`;
        const itemViolations = validateSchema(itemSchema, item, itemPath);

        if (itemViolations.length > 0) {
          if (data.length - 1 >= minItems) {
            removedElements.push(itemPath);
            operations.push({
              level: 3,
              type: "remove_invalid_array_item",
              path: itemPath,
              description: `Removed invalid array item at index ${idx} (${itemViolations[0]})`,
              details: { violations: itemViolations },
            });
            continue;
          }
        }

        validItems.push(
          selectiveRemovalLevel3(
            itemSchema,
            item,
            operations,
            removedElements,
            `${path}[${validItems.length}]`,
          ),
        );
      }
      data = validItems;
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// Fallback Content Generation
// ---------------------------------------------------------------------------

export function buildFallbackContent(
  jsonSchema: JsonObject | null | undefined,
  outline: string,
): Dict {
  const parsedOutline = parseOutline(outline);
  const heading = parsedOutline.heading || "Slide overview";
  const body = parsedOutline.body || heading;
  const content: Dict = { __speaker_note__: body.slice(0, 450) };

  const properties =
    isRecord(jsonSchema) && isRecord(jsonSchema.properties)
      ? jsonSchema.properties
      : null;
  if (!properties) return content;

  for (const [key, property] of Object.entries(properties)) {
    if (!isRecord(property)) continue;
    if (key === "__speaker_note__") continue;
    if (/^__(?:image|icon)_url__$|^__/.test(key)) continue;

    if (property.const !== undefined) {
      content[key] = property.const;
    } else if (property.type === "string") {
      if (Array.isArray(property.enum) || typeof property.const === "string") continue;
      const isTitle = /title|heading|headline|name/i.test(key);
      const strVal = isTitle ? heading : body;
      content[key] = fitStringToSchema(strVal, property, body);
    } else if (property.type === "object") {
      const nestedOps: RepairOperation[] = [];
      const nestedRec: string[] = [];
      const nested = constructObjectFromOutline(
        property,
        parsedOutline,
        0,
        nestedOps,
        nestedRec,
        key,
      );
      if (nested) content[key] = nested;
    } else if (property.type === "array") {
      const minItems = typeof property.minItems === "number" ? property.minItems : 1;
      const itemSchema = isRecord(property.items) ? property.items : null;
      if (itemSchema) {
        const arr: any[] = [];
        for (let i = 0; i < minItems; i++) {
          if (itemSchema.type === "object") {
            const nestedOps: RepairOperation[] = [];
            const nestedRec: string[] = [];
            const nested = constructObjectFromOutline(
              itemSchema,
              parsedOutline,
              i,
              nestedOps,
              nestedRec,
              `${key}[${i}]`,
            );
            if (nested) arr.push(nested);
          } else if (itemSchema.type === "string") {
            const itemText = parsedOutline.bullets[i] || parsedOutline.bullets[0] || heading;
            arr.push(fitStringToSchema(itemText, itemSchema, parsedOutline.body));
          } else if (itemSchema.type === "array" && isRecord(itemSchema.items)) {
            const rowMin = typeof itemSchema.minItems === "number" ? itemSchema.minItems : 2;
            const row: any[] = [];
            for (let c = 0; c < rowMin; c++) {
              const cell = (c === 0 ? parsedOutline.bullets[i] : parsedOutline.metrics[i]?.raw) || "Data";
              row.push(fitStringToSchema(cell, itemSchema.items, parsedOutline.body));
            }
            arr.push(row);
          }
        }
        content[key] = arr;
      }
    }
  }

  // Ensure speaker note satisfies minLength
  if (properties.__speaker_note__) {
    content.__speaker_note__ = fitStringToSchema(
      content.__speaker_note__,
      properties.__speaker_note__,
      parsedOutline.body || parsedOutline.heading,
    );
  }

  return content;
}

// ---------------------------------------------------------------------------
// Orchestrator: Full 3-Level Schema Repair & Validation Pipeline
// ---------------------------------------------------------------------------

export interface RepairResult {
  content: Dict;
  passedValidation: boolean;
  violations: string[];
  diagnostics: RepairDiagnostics;
}

export function executeSchemaRepairPipeline(options: {
  schema: Dict;
  generatedJson: Dict;
  outlineContent: string;
  slideNumber: number;
  slideId?: string;
  initialUsage?: { prompt_tokens: number; completion_tokens: number };
  isExceptionalRetry?: boolean;
}): RepairResult {
  const {
    schema,
    generatedJson,
    outlineContent,
    slideNumber,
    slideId,
    initialUsage,
    isExceptionalRetry = false,
  } = options;

  const parsedOutline = parseOutline(outlineContent);
  const repairOperations: RepairOperation[] = [];
  const reconstructedFields: string[] = [];
  const removedElements: string[] = [];

  // Step 0: Initial Validation
  const originalViolations = validateSchema(schema, generatedJson);
  if (originalViolations.length === 0) {
    return {
      content: generatedJson,
      passedValidation: true,
      violations: [],
      diagnostics: {
        slideId,
        slideIndex: slideNumber - 1,
        originalViolations: [],
        repairOperations: [],
        reconstructedFields: [],
        removedElements: [],
        finalValidationPassed: true,
        exceptionalRetryRequired: isExceptionalRetry,
        finalGenerationSource: isExceptionalRetry
          ? "exceptional_retry_clean"
          : "ai_generated_clean",
        tokenUsage: initialUsage
          ? {
              initialPromptTokens: initialUsage.prompt_tokens,
              initialCompletionTokens: initialUsage.completion_tokens,
              finalPromptTokens: initialUsage.prompt_tokens,
              finalCompletionTokens: initialUsage.completion_tokens,
              estimatedTokensSaved: 0,
            }
          : undefined,
      },
    };
  }

  let workingCopy = clone(generatedJson);

  // Level 1: Automatic Structural Repair
  workingCopy = repairStructuralLevel1(schema, workingCopy, repairOperations, "root", removedElements);

  // Level 2: Outline-Aware Content Reconstruction
  workingCopy = reconstructContentLevel2(
    schema,
    workingCopy,
    parsedOutline,
    repairOperations,
    reconstructedFields,
  );

  // Level 3: Selective Removal of invalid optional elements
  workingCopy = selectiveRemovalLevel3(
    schema,
    workingCopy,
    repairOperations,
    removedElements,
  );

  // Step 4: Final Strict Schema Validation
  const finalViolations = validateSchema(schema, workingCopy);
  const passedValidation = finalViolations.length === 0;

  const diagnostics: RepairDiagnostics = {
    slideId,
    slideIndex: slideNumber - 1,
    originalViolations,
    repairOperations,
    reconstructedFields,
    removedElements,
    finalValidationPassed: passedValidation,
    remainingViolations: finalViolations,
    exceptionalRetryRequired: isExceptionalRetry,
    finalGenerationSource: passedValidation
      ? isExceptionalRetry
        ? "exceptional_retry_repaired"
        : "ai_generated_repaired"
      : "outline_fallback",
    tokenUsage: initialUsage
      ? {
          initialPromptTokens: initialUsage.prompt_tokens,
          initialCompletionTokens: initialUsage.completion_tokens,
          finalPromptTokens: initialUsage.prompt_tokens,
          finalCompletionTokens: initialUsage.completion_tokens,
          // If we repaired without an LLM retry, we saved a full prompt + completion pass
          estimatedTokensSaved: passedValidation && !isExceptionalRetry
            ? initialUsage.prompt_tokens + initialUsage.completion_tokens
            : 0,
        }
      : undefined,
  };

  return {
    content: workingCopy,
    passedValidation,
    violations: finalViolations,
    diagnostics,
  };
}

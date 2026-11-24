#!/usr/bin/env node
/**
 * Mocked-LLM smoke test for every bundled template.
 *
 * Bundles the generation modules with esbuild (no network or database calls are
 * made by these modules at import time) and hydrates each layout with
 * schema-shaped placeholder content, mirroring what the stream route does after
 * a successful LLM call.
 */
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

const entrySource = `
import { BUNDLED_TEMPLATES } from "@/lib/v3/templates/bundledTemplates";
import {
  normalizeTemplatePayload,
  buildTemplateLayoutModel,
} from "@/lib/v3/generation/layoutModel";
import { prepareResponseSchema } from "@/lib/v3/generation/slideContent";
import { applyTemplateContentToUi } from "@/lib/v3/generation/templateHydrate";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sampleString(schema) {
  if (typeof schema.const === "string") return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length) return String(schema.enum[0]);
  const min = typeof schema.minLength === "number" ? schema.minLength : 0;
  const base = "Sample presentation copy for layout validation.";
  if (base.length >= min) return base;

  let value = base;
  while (value.length < min) value += " Additional detail.";
  return value;
}

function sampleValue(schema, depth = 0) {
  if (!isRecord(schema)) return "Sample";
  if (typeof schema.const === "string") return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (Array.isArray(schema.type)) schema = { ...schema, type: schema.type[0] };

  switch (schema.type) {
    case "object": {
      const result = {};
      const properties = isRecord(schema.properties) ? schema.properties : {};
      for (const [key, nested] of Object.entries(properties)) {
        if (key === "$schema") continue;
        result[key] = sampleValue(nested, depth + 1);
      }
      return result;
    }
    case "array": {
      const count = Math.max(1, Math.min(schema.minItems || 1, 3));
      return Array.from({ length: count }, () =>
        sampleValue(isRecord(schema.items) ? schema.items : { type: "string" }, depth + 1),
      );
    }
    case "number":
      return typeof schema.minimum === "number" ? schema.minimum : 1;
    case "integer":
      return typeof schema.minimum === "number" ? Math.ceil(schema.minimum) : 1;
    case "boolean":
      return true;
    default:
      return sampleString(schema);
  }
}

export function runTemplateSmoke() {
  const failures = [];
  const templates = BUNDLED_TEMPLATES;
  let layoutCount = 0;
  let hydratedLayouts = 0;

  for (const template of templates) {
    const templateId = template.id || template.name || "unknown";
    try {
      const payload = normalizeTemplatePayload(template);
      if (!payload.layouts.length) {
        failures.push(templateId + ": no layouts after normalization");
        continue;
      }
      const model = buildTemplateLayoutModel(payload);
      if (!model.slides.length) {
        failures.push(templateId + ": no layout model entries");
        continue;
      }

      for (const slide of model.slides) {
        layoutCount += 1;
        const prepared = prepareResponseSchema(slide.json_schema);
        if (!prepared) {
          failures.push(templateId + "/" + slide.id + ": no usable content schema");
          continue;
        }
        const content = sampleValue(prepared);
        const sourceLayout = payload.layouts.find(
          (layout) => String(layout.id) === String(slide.id),
        ) || payload.layouts[0];
        if (!sourceLayout) {
          failures.push(templateId + "/" + slide.id + ": layout source missing");
          continue;
        }
        const hydrated = applyTemplateContentToUi(
          JSON.parse(JSON.stringify(sourceLayout)),
          content,
        );
        if (!isRecord(hydrated) || !Array.isArray(hydrated.components)) {
          failures.push(templateId + "/" + slide.id + ": hydration returned no components");
          continue;
        }
        if (!hydrated.components.length) {
          failures.push(templateId + "/" + slide.id + ": hydration produced an empty layout");
          continue;
        }
        hydratedLayouts += 1;
      }
    } catch (error) {
      failures.push(templateId + ": " + (error instanceof Error ? error.message : String(error)));
    }
  }

  return {
    templates: templates.length,
    layouts: layoutCount,
    hydrated: hydratedLayouts,
    failures,
  };
}
`;

// Keep the bundle inside the project so bare imports resolve from node_modules.
const workingDir = await mkdtemp(path.join(root, ".smoke-templates-"));
const entryPath = path.join(workingDir, "entry.ts");
const outPath = path.join(workingDir, "entry.mjs");

try {
  await writeFile(entryPath, entrySource, "utf8");
  await build({
    entryPoints: [entryPath],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile: outPath,
    logLevel: "warning",
    alias: { "@": root },
    external: ["@neondatabase/serverless"],
  });

  const { runTemplateSmoke } = await import(pathToFileURL(outPath).href);
  const result = runTemplateSmoke();

  console.log(
    `Templates: ${result.templates}, layouts: ${result.layouts}, hydrated: ${result.hydrated}`,
  );
  if (result.failures.length) {
    console.error(`\n${result.failures.length} failure(s):`);
    for (const failure of result.failures) console.error(` - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("All bundled templates hydrated successfully.");
  }
} finally {
  await rm(workingDir, { recursive: true, force: true });
}

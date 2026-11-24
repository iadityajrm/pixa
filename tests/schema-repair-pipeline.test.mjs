import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { buildTemplateLayoutModel } from "../lib/v3/generation/layoutModel.js";
import { prepareResponseSchema } from "../lib/v3/generation/slideContent.js";
import {
  executeSchemaRepairPipeline,
  parseJsonWithRepair,
  validateSchema,
  assessFundamentallyUnusable,
  buildFallbackContent,
  parseOutline,
} from "../lib/v3/generation/schemaRepair.js";
import { applyTemplateContentToUi } from "../lib/v3/generation/templateHydrate.js";
import { addPlaceholderAssets } from "../lib/v3/generation/assets.js";

const standardTemplatePath = path.resolve(process.cwd(), "public/templates/standard/template.json");
const standardTemplate = JSON.parse(fs.readFileSync(standardTemplatePath, "utf8"));
const layoutModel = buildTemplateLayoutModel(standardTemplate);

const sampleOutline = `
# Slide 3: Enterprise Cloud Infrastructure
- Scalable Compute Architecture: Scaling from 10k to 500k RPS seamlessly across regions.
- High Availability & Resilience: Guaranteed 99.99% uptime with automated multi-zone failover.
- Cost Optimization Milestones: 42% operational savings through intelligent workload batching.
`;

test("Level 1: parses and fixes malformed JSON (unclosed brackets, trailing commas, markdown fences)", () => {
  const malformed = `\`\`\`json
  {
    "top_title_block": {
      "centered_heading": "Cloud Architecture",
    },
    "three_card_row": {
      "card_grid": [
        { "card_title": "Scalability", "card_caption": "Auto-scaling microservices.", "card_image": { "image_prompt": "servers" } },
        { "card_title": "Resilience", "card_caption": "Multi-region failover network.", "card_image": { "image_prompt": "shield" } }
      ]
  `;

  const parsed = parseJsonWithRepair(malformed);
  assert.ok(parsed, "Should successfully parse repaired JSON string");
  assert.equal(parsed.top_title_block.centered_heading, "Cloud Architecture");
  assert.equal(parsed.three_card_row.card_grid.length, 2);
});

test("Level 1: handles type coercion, enum correction, unexpected properties, and maxItems truncation", () => {
  const chartLayout = layoutModel.slides.find((s) => s.id.includes("chart"));
  assert.ok(chartLayout, "Chart layout must exist in standard template");
  const chartSchema = prepareResponseSchema(chartLayout.json_schema);

  const rawGenerated = {
    unexpected_extra: "should be stripped",
    left_chart_panel: {
      primary_line_chart: {
        chart_type: "spline_trend", // invalid enum -> line
        categories: ["Q1", "Q2", "Q3", "Q4", "Q5"],
        series: [
          {
            name: "Revenue",
            values: ["100", "200", "300", "400", "500"], // string values -> numbers
          },
        ],
      },
    },
    right_text_block: {
      large_heading_text: 998877, // number -> string
      supporting_paragraph_text:
        "Comprehensive financial review across quarters illustrating steady growth trajectories and margins.",
    },
    __speaker_note__:
      "Quarterly performance metrics demonstrating solid market expansion and operational cost control.",
  };

  const result = executeSchemaRepairPipeline({
    schema: chartSchema,
    generatedJson: rawGenerated,
    outlineContent: sampleOutline,
    slideNumber: 2,
    initialUsage: { prompt_tokens: 1200, completion_tokens: 350 },
  });

  assert.equal(result.passedValidation, true, "Should pass final strict validation");
  assert.equal(result.violations.length, 0);

  const chart = result.content.left_chart_panel.primary_line_chart;
  assert.equal(chart.chart_type, "line", "spline_trend should be normalized to line");
  assert.deepEqual(chart.series[0].values, [100, 200, 300, 400, 500], "values coerced to numbers");
  assert.equal(typeof result.content.right_text_block.large_heading_text, "string");
  assert.equal(result.content.unexpected_extra, undefined, "unexpected extra property must be removed");
  assert.equal(result.diagnostics.finalGenerationSource, "ai_generated_repaired");
});

test("Level 2: reconstructs missing cards from outline to satisfy minItems", () => {
  const cardLayout = layoutModel.slides[6]; // center_title_cards_2395 (requires 3 cards)
  const schema = prepareResponseSchema(cardLayout.json_schema);

  // Model returned only 2 cards
  const partialGenerated = {
    top_title_block: {
      centered_heading: "Enterprise Cloud Infra",
    },
    three_card_row: {
      card_grid: [
        {
          card_title: "Scalability",
          card_caption: "Scaling from 10k to 500k RPS seamlessly across regions.",
          card_image: { image_prompt: "cloud servers" },
        },
        {
          card_title: "Resilience",
          card_caption: "Guaranteed 99.99% uptime with automated multi-zone failover.",
          card_image: { image_prompt: "shield protection" },
        },
      ],
    },
    __speaker_note__:
      "Comprehensive walk-through of modern infrastructure scaling, uptime guarantees, and cost optimization initiatives.",
  };

  const initialViolations = validateSchema(schema, partialGenerated);
  assert.ok(initialViolations.length > 0, "Initial partial content must violate minItems");

  const result = executeSchemaRepairPipeline({
    schema,
    generatedJson: partialGenerated,
    outlineContent: sampleOutline,
    slideNumber: 3,
    initialUsage: { prompt_tokens: 1600, completion_tokens: 420 },
  });

  assert.equal(result.passedValidation, true, "Repaired content must pass strict schema validation");
  assert.equal(result.content.three_card_row.card_grid.length, 3, "Third card must be reconstructed");

  const card3 = result.content.three_card_row.card_grid[2];
  assert.ok(card3.card_title, "Card 3 must have a title");
  assert.ok(card3.card_caption, "Card 3 must have a caption");
  assert.ok(card3.card_image.image_prompt, "Card 3 must have an image prompt");
  assert.ok(
    result.diagnostics.reconstructedFields.some((f) => f.includes("card_grid[2]")),
    "Diagnostics must record reconstructed card 3",
  );
  assert.ok(
    (result.diagnostics.tokenUsage?.estimatedTokensSaved ?? 0) > 0,
    "Token savings must be recorded",
  );
});

test("Level 3: selectively removes invalid optional elements without discarding valid slide content", () => {
  const landmarkPath = path.resolve(process.cwd(), "public/templates/landmark/template.json");
  const landmarkTemplate = JSON.parse(fs.readFileSync(landmarkPath, "utf8"));
  const landmarkLm = buildTemplateLayoutModel(landmarkTemplate);
  const timelineSlide = landmarkLm.slides.find(
    (s) => s.id === "branded_header_centered_title_connected_timeline_3792",
  );
  assert.ok(timelineSlide, "Landmark timeline slide must exist");
  const timelineSchema = prepareResponseSchema(timelineSlide.json_schema);

  const generatedWithCorruptOptional = {
    title_block: {
      title_and_subtitle: {
        title: "Product Milestones 2025",
        subtitle: "A detailed strategic roadmap outlining quarterly expansion and key milestones.",
      },
    },
    connected_timeline: {
      process_timeline: {
        data: {
          type: "timeline",
          items: [
            {
              heading: "Phase 1: Rollout",
              description: "Initial platform deployment across core clusters.",
              label: "Q1 Launch",
              focus: "Execution",
              icon: { malformed_garbage_data: true }, // Invalid optional icon!
            },
          ],
        },
      },
    },
    __speaker_note__:
      "Reviewing the multi-stage infrastructure roadmap and operational delivery milestones for upcoming quarters.",
  };

  const result = executeSchemaRepairPipeline({
    schema: timelineSchema,
    generatedJson: generatedWithCorruptOptional,
    outlineContent: sampleOutline,
    slideNumber: 4,
  });

  assert.equal(result.passedValidation, true, "Must pass strict schema validation");
  const item = result.content.connected_timeline.process_timeline.data.items[0];
  assert.equal(item.heading, "Phase 1: Rollout");
  assert.equal(item.icon, undefined, "Invalid optional icon must be safely removed");
  assert.ok(
    result.diagnostics.removedElements.some((e) => e.includes("icon")),
    "Diagnostics must record the removed optional element",
  );
});

test("Assessment: correctly identifies fundamentally unusable responses vs repairable responses", () => {
  const cardLayout = layoutModel.slides[6];
  const schema = prepareResponseSchema(cardLayout.json_schema);

  // 1. Non-JSON string
  const unusable1 = assessFundamentallyUnusable("Here is some text without JSON.", null, schema);
  assert.equal(unusable1.isUnusable, true);

  // 2. Unrelated JSON object
  const unusable2 = assessFundamentallyUnusable(
    '{"completely_alien": {"unrelated": 123}}',
    { completely_alien: { unrelated: 123 } },
    schema,
  );
  assert.equal(unusable2.isUnusable, true);

  // 3. Repairable slide with minor errors
  const repairable = assessFundamentallyUnusable(
    '{"top_title_block": {"centered_heading": "Valid"}}',
    { top_title_block: { centered_heading: "Valid" } },
    schema,
  );
  assert.equal(repairable.isUnusable, false);
});

test("Fallback content: synthesizes valid, subject-matter-rich slide when generation is impossible", () => {
  const cardLayout = layoutModel.slides[6];
  const schema = prepareResponseSchema(cardLayout.json_schema);
  const fallback = buildFallbackContent(schema, sampleOutline);

  const violations = validateSchema(schema, fallback);
  assert.equal(violations.length, 0, "Fallback content must strictly satisfy schema");
  assert.ok(fallback.top_title_block.centered_heading, "Heading must be populated from outline");
  assert.equal(fallback.three_card_row.card_grid.length, 3, "All required cards must be populated");
  assert.ok(fallback.__speaker_note__.length >= 100, "Speaker note must satisfy minLength");
});

test("Rendering compatibility: repaired slide hydrates template UI without errors", () => {
  const cardLayout = layoutModel.slides[6];
  const rawLayout = standardTemplate.layouts.find((l) => l.id === cardLayout.id);
  const schema = prepareResponseSchema(cardLayout.json_schema);

  const faulty = {
    top_title_block: {
      centered_heading: "Cloud Strategy",
    },
    three_card_row: {
      card_grid: [
        {
          card_title: 1234, // number type error
          card_caption: "Short caption.",
          card_image: { image_prompt: "graphic" },
        },
      ],
    },
  };

  const result = executeSchemaRepairPipeline({
    schema,
    generatedJson: faulty,
    outlineContent: sampleOutline,
    slideNumber: 6,
  });

  assert.equal(result.passedValidation, true);
  addPlaceholderAssets(result.content);
  const ui = applyTemplateContentToUi(rawLayout, result.content);
  assert.ok(ui && Array.isArray(ui.components));
  assert.equal(ui.components.length, 3);
});

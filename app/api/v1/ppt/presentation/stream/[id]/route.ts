import { NextRequest } from "next/server";
import { repairBrokenSlidesBatch } from "@/lib/v3/batched-slide-repair";
import crypto from "crypto";
import { query, queryOne } from "@/lib/v3/db";
import { getTemplateById } from "@/lib/v3/templates";
import {
  buildTemplateLayoutModel,
  generatePresentationStructure,
  normalizeStructure,
  normalizeTemplatePayload,
  selectTitleSlideLayoutIndex,
  type TemplatePayload,
} from "@/lib/v3/generation/layoutModel";
import {
  generateSlideContent,
  type SlideContentUsage,
} from "@/lib/v3/generation/slideContent";
import {
  buildFallbackContent,
  outlineHeading,
  outlineBody,
  type RepairDiagnostics,
} from "@/lib/v3/generation/schemaRepair";
import { applyTemplateContentToUi } from "@/lib/v3/generation/templateHydrate";
import { addPlaceholderAssets, resolveSlideAssets } from "@/lib/v3/generation/assets";
import { refundGenerationCredits } from "@/lib/v3/services/creditService";
import type { JsonObject, PresentationLayoutModel } from "@/lib/v3/generation/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// Slide content generation used to run strictly one slide at a time, so a deck
// took (slides × call latency) plus every provider backoff in sequence. A small
// bounded pool overlaps those calls while keeping output in slide order.
const SLIDE_CONCURRENCY = Math.min(
  4,
  Math.max(
    1,
    Number.parseInt(process.env.PRESENTATION_SLIDE_CONCURRENCY ?? "", 10) || 3,
  ),
);

// Stop retrying before the function deadline is reached; slides that cannot
// finish in time fall back to outline content instead of stalling the deck.
const PRESENTATION_GENERATION_DEADLINE_MS = 240_000;

type Dict = Record<string, any>;

const INSERT_SLIDE_SQL = `INSERT INTO slides (
  id, presentation, owner_id, layout_group, layout, "index",
  content, html_content, speaker_note, properties, ui
) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, NULL, $9)`;

function isRecord(value: unknown): value is Dict {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sse(controller: ReadableStreamDefaultController, encoder: TextEncoder, data: unknown) {
  controller.enqueue(
    encoder.encode(`event: response\ndata: ${JSON.stringify(data)}\n\n`)
  );
}

function outlineContentsFromPresentation(outlines: unknown): string[] {
  const slides = isRecord(outlines) && Array.isArray(outlines.slides)
    ? outlines.slides
    : Array.isArray(outlines)
      ? outlines
      : [];

  return slides
    .map((item: unknown) => {
      if (typeof item === "string") return item;
      if (!isRecord(item)) return "";
      if (typeof item.content === "string" && item.content.trim()) {
        return typeof item.title === "string" && item.title.trim()
          ? `## ${item.title.trim()}\n${item.content}`
          : item.content;
      }
      return typeof item.title === "string" ? item.title : "";
    });
}

function templateLayoutPayload(layout: unknown): Dict | null {
  return isRecord(layout) && Array.isArray(layout.layouts) ? layout : null;
}

async function resolveTemplatePayload(layout: unknown): Promise<TemplatePayload | null> {
  const persisted = templateLayoutPayload(layout);
  const templateId =
    (persisted && typeof persisted.template_id === "string" && persisted.template_id) ||
    (persisted && typeof persisted.name === "string" && persisted.name) ||
    null;

  if (templateId) {
    const template = await getTemplateById(templateId).catch(() => null);
    if (template) {
      const payload = normalizeTemplatePayload(template);
      if (payload.layouts.length) return payload;
    }
  }

  if (!persisted) return null;

  return {
    name: typeof persisted.name === "string" ? persisted.name : "template",
    template_id:
      typeof persisted.template_id === "string" ? persisted.template_id : "template",
    icon_type: typeof persisted.icon_type === "string" ? persisted.icon_type : "regular",
    icon_weight: "regular",
    layouts: persisted.layouts,
    merged_components: Array.isArray(persisted.merged_components)
      ? persisted.merged_components
      : [],
    fonts: null,
    theme: isRecord(persisted.theme) ? persisted.theme : null,
  };
}

function templateSlideUi(payload: TemplatePayload, layoutId: string): Dict {
  const source =
    payload.layouts.find((layout) => String(layout.id) === String(layoutId)) ??
    payload.layouts[0] ??
    {};
  return clone(source);
}

async function resolveStructure(
  presentation: Dict,
  layoutModel: PresentationLayoutModel,
  outlines: string[],
): Promise<number[]> {
  const persisted = isRecord(presentation.structure) &&
    Array.isArray(presentation.structure.slides)
    ? presentation.structure.slides
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isInteger(value))
    : [];

  let structure =
    persisted.length === outlines.length
      ? persisted
      : persisted.length
        ? normalizeStructure(persisted, outlines.length, layoutModel.slides.length)
        : normalizeStructure(
            await generatePresentationStructure({
              layout: layoutModel,
              outlines,
              instructions: presentation.instructions,
              sourceContent: presentation.content,
            }),
            outlines.length,
            layoutModel.slides.length,
          );

  if (presentation.include_title_slide !== false && structure.length) {
    const titleLayoutIndex = selectTitleSlideLayoutIndex(layoutModel);
    if (titleLayoutIndex !== -1) structure = [titleLayoutIndex, ...structure.slice(1)];
  }

  return structure;
}

async function loadPresentationWithSlides(id: string) {
  return queryOne(
    `SELECT p.*,
            COALESCE(
              json_agg(s.* ORDER BY s.index ASC) FILTER (WHERE s.id IS NOT NULL),
              '[]'
            ) as slides
     FROM presentations p
     LEFT JOIN slides s ON s.presentation = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [id]
  );
}

interface PersistedSlideRow {
  id: string;
  layout_group: string;
  layout: string;
  index: number;
  content: Dict;
  ui: Dict | null;
  speaker_note: string | null;
}

function slideFromRow(
  row: PersistedSlideRow,
  presentation: Dict,
): Dict {
  return {
    id: row.id,
    presentation: presentation.id,
    owner_id: presentation.owner_id ?? null,
    layout_group: row.layout_group,
    layout: row.layout,
    index: Number(row.index),
    content: isRecord(row.content) ? row.content : {},
    speaker_note: row.speaker_note ?? "",
    ui: isRecord(row.ui) ? row.ui : null,
  };
}

async function persistSlide(presentation: Dict, slide: Dict) {
  await query(
    'DELETE FROM slides WHERE presentation = $1 AND "index" = $2',
    [presentation.id, slide.index],
  );
  await query(INSERT_SLIDE_SQL, [
    slide.id,
    slide.presentation,
    slide.owner_id,
    slide.layout_group,
    slide.layout,
    slide.index,
    JSON.stringify(slide.content),
    slide.speaker_note,
    JSON.stringify(slide.ui),
  ]);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const presentation = await queryOne<any>(
    "SELECT * FROM presentations WHERE id = $1",
    [id]
  );

  if (!presentation) {
    return new Response(JSON.stringify({ detail: "Presentation not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let completedCount = 0;
      let streamAlive = true;
      let totalCount =
        isRecord(presentation.outlines) && Array.isArray(presentation.outlines.slides)
          ? presentation.outlines.slides.length
          : Array.isArray(presentation.outlines)
            ? presentation.outlines.length
            : 0;

      const fail = async (message: string) => {
        streamAlive = false;
        console.error("[Pixa V3 presentation stream] Failed:", message);
        try {
          const refund = await refundGenerationCredits(
            id,
            "Presentation generation failed",
          );
          if (refund.refunded) {
            console.warn(
              `[Pixa V3 presentation stream] refunded ${refund.amount} credits for ${id}`,
            );
          }
        } catch (refundError) {
          console.error(
            "[Pixa V3 presentation stream] credit refund failed:",
            refundError,
          );
        }
        try {
          sse(controller, encoder, {
            type: "error",
            detail: message,
            retryable: false,
            completed_slides: completedCount,
            total_slides: totalCount,
          });
        } catch {}
        controller.close();
      };

      try {
        sse(controller, encoder, {
          type: "status",
          status: "Preparing your presentation",
        });

        const payload = await resolveTemplatePayload(presentation.layout);
        if (!payload || !payload.layouts.length) {
          await fail(
            "This presentation was not prepared with a template. Please regenerate it from the outline step.",
          );
          return;
        }

        const layoutModel = buildTemplateLayoutModel(payload);
        if (!layoutModel.slides.length) {
          await fail("The selected template does not contain any usable slide layouts.");
          return;
        }

        const outlines = outlineContentsFromPresentation(presentation.outlines);
        if (!outlines.length) {
          await fail("Outlines cannot be empty.");
          return;
        }
        totalCount = outlines.length;

        if (payload.fonts) {
          sse(controller, encoder, { type: "fonts", fonts: payload.fonts });
        }

        const structure = await resolveStructure(presentation, layoutModel, outlines);
        const layoutIdForIndex = (index: number) =>
          String(
            (layoutModel.slides[structure[index] ?? 0] ?? layoutModel.slides[0])?.id ??
              "",
          );

        // Progressive persistence: a failed stream can be resumed and only the
        // remaining slides are generated on retry.
        const persistedRows = await query<PersistedSlideRow>(
          `SELECT id, layout_group, layout, "index", content, speaker_note, ui
           FROM slides WHERE presentation = $1 ORDER BY "index" ASC`,
          [id],
        );

        const rowsByIndex = new Map<number, PersistedSlideRow>();
        for (const row of persistedRows.rows) {
          const index = Number(row.index);
          if (!Number.isInteger(index) || index < 0 || index >= outlines.length) continue;
          if (row.layout_group !== layoutModel.name) continue;
          if (String(row.layout) !== layoutIdForIndex(index)) continue;
          if (!isRecord(row.content)) continue;
          rowsByIndex.set(index, row);
        }

        let resumeIndex = 0;
        while (rowsByIndex.has(resumeIndex)) resumeIndex += 1;

        if (resumeIndex > 0) {
          sse(controller, encoder, {
            type: "status",
            status: `Resuming from slide ${resumeIndex + 1}`,
          });
        }

        await query(
          'DELETE FROM slides WHERE presentation = $1 AND "index" >= $2',
          [id, resumeIndex],
        );

        sse(controller, encoder, { type: "chunk", chunk: '{ "slides": [ ' });

        for (let index = 0; index < resumeIndex; index += 1) {
          const row = rowsByIndex.get(index);
          if (!row) continue;
          const slide = slideFromRow(row, presentation);
          completedCount = Math.max(completedCount, index + 1);
          sse(controller, encoder, {
            type: "chunk",
            chunk: JSON.stringify(slide),
          });
        }

        const iconWeight = payload.icon_weight;
        const warnings: string[] = [];
        const metrics = {
          input_tokens: 0,
          output_tokens: 0,
          model: "",
          calls: 0,
        };
        const recordUsage = (usage: SlideContentUsage) => {
          metrics.input_tokens += usage.prompt_tokens;
          metrics.output_tokens += usage.completion_tokens;
          metrics.model = usage.model || metrics.model;
          metrics.calls += 1;
        };
        const generationStartedAt = Date.now();
        const retryDeadlineMs =
          generationStartedAt + PRESENTATION_GENERATION_DEADLINE_MS;

        type SlideResult = {
          index: number;
          slide: Dict;
          slideWarnings: string[];
        };

        const generateSlide = async (index: number): Promise<SlideResult> => {
          const slideLayout =
            (layoutModel.slides[structure[index] ?? 0] ?? layoutModel.slides[0])!;

          let content: Dict;
          const slideWarnings: string[] = [];
          const slideId = crypto.randomUUID();
          try {
            content = await generateSlideContent({
              slideLayout,
              outlineContent: outlines[index],
              language: presentation.language,
              tone: presentation.tone,
              verbosity: presentation.verbosity,
              instructions: presentation.instructions,
              slideNumber: index + 1,
              slideId,
              retryDeadlineMs,
              onRetry: (info) => {
                try {
                  sse(controller, encoder, {
                    type: "status",
                    status: `Slide ${index + 1}: waiting for provider capacity (retry ${info.attempt}, ~${Math.max(
                      1,
                      Math.round(info.waitMs / 1000),
                    )}s)`,
                  });
                } catch {
                  // The client disconnected; the slide is still persisted below.
                }
              },
              onUsage: recordUsage,
              onDiagnostics: (diag) => {
                if (diag.repairOperations.length > 0 || diag.remainingViolations?.length) {
                  slideWarnings.push(
                    `Slide ${index + 1}: automatic schema repair applied (${diag.repairOperations.length} operations, source: ${diag.finalGenerationSource}).`,
                  );
                }
              },
            });
          } catch (error) {
            console.warn(
              `[Pixa V3 presentation stream] slide ${index + 1} fell back to outline content:`,
              error,
            );
            content = buildFallbackContent(slideLayout.json_schema, outlines[index]);
            slideWarnings.push(
              `Slide ${index + 1} was created from the outline without AI content.`,
            );
          }

          addPlaceholderAssets(content);
          const ui = applyTemplateContentToUi(
            templateSlideUi(payload, slideLayout.id),
            content,
          );
          slideWarnings.push(...(await resolveSlideAssets(content, { iconWeight })));
          const hydratedUi = applyTemplateContentToUi(ui, content);

          const slide = {
            id: slideId,
            presentation: id,
            owner_id: presentation.owner_id ?? null,
            layout_group: layoutModel.name,
            layout: slideLayout.id,
            index,
            content,
            speaker_note:
              typeof content.__speaker_note__ === "string"
                ? content.__speaker_note__
                : "",
            ui: hydratedUi,
          };

          // Persist as soon as the slide is complete so an interrupted stream
          // can resume instead of regenerating work that already finished.
          await persistSlide(presentation, slide);
          completedCount += 1;
          return { index, slide, slideWarnings };
        };

        const tasks = new Map<number, Promise<SlideResult>>();
        let nextToStart = resumeIndex;
        const launchNext = () => {
          if (!streamAlive || nextToStart >= outlines.length) return;
          const index = nextToStart;
          nextToStart += 1;
          const task = generateSlide(index);
          tasks.set(index, task);
          const settle = () => launchNext();
          task.then(settle, settle);
        };
        while (
          nextToStart < Math.min(resumeIndex + SLIDE_CONCURRENCY, outlines.length)
        ) {
          launchNext();
        }

        // Emit slides strictly in index order so the streamed JSON array stays
        // valid, even though the slides themselves finish out of order.
        for (let index = resumeIndex; index < outlines.length; index += 1) {
          const task = tasks.get(index);
          if (!task) continue;
          const { slide, slideWarnings } = await task;
          tasks.delete(index);

          warnings.push(...slideWarnings);
          sse(controller, encoder, {
            type: "chunk",
            chunk: JSON.stringify(slide),
          });
          if (slideWarnings.length) {
            sse(controller, encoder, {
              type: "slide_assets",
              slide_index: index,
              slide,
              warnings: [...new Set(slideWarnings)].map((detail) => ({
                type: "asset_generation_failed",
                detail,
              })),
            });
          }
        }

        sse(controller, encoder, { type: "chunk", chunk: " ] }" });

        if (warnings.length) {
          console.warn(
            "[Pixa V3 presentation stream] warnings:",
            [...new Set(warnings)],
          );
        }

        if (metrics.calls > 0) {
          const durationSeconds = Math.max(
            0.001,
            (Date.now() - generationStartedAt) / 1000,
          );
          sse(controller, encoder, {
            type: "generation_metrics",
            model: metrics.model,
            input_tokens: metrics.input_tokens,
            output_tokens: metrics.output_tokens,
            total_tokens: metrics.input_tokens + metrics.output_tokens,
            thinking_tokens: null,
            thinking_tokens_estimated: false,
            estimated: false,
            supports_thinking: false,
            duration_seconds: Number(durationSeconds.toFixed(2)),
            tokens_per_second: Math.round(metrics.output_tokens / durationSeconds),
          });
        }

        const completed = await loadPresentationWithSlides(id);

        sse(controller, encoder, {
          type: "complete",
          presentation: {
            ...(completed ?? presentation),
            type: "standard",
          },
        });
        controller.close();
      } catch (err: any) {
        await fail(err?.message || "Failed to stream presentation");
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

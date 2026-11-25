import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { query, queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";
import { getTemplateById } from "@/lib/v3/templates";
import {
  buildTemplateLayoutModel,
  generatePresentationStructure,
  getNoOfTocRequiredForNOutlines,
  insertTocLayouts,
  normalizeStructure,
  normalizeTemplatePayload,
  selectTitleSlideLayoutIndex,
  selectTocOrListSlideLayoutIndex,
} from "@/lib/v3/generation/layoutModel";
import { resolveTemplateTheme } from "@/lib/template-theme";
import { MAX_NUMBER_OF_SLIDES } from "@/utils/presentationLimits";

export const runtime = "nodejs";
export const maxDuration = 300;

function normalizeOutlines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && typeof item.content === "string") {
        return item.content;
      }
      return "";
    })
    .map((content) => content.trim())
    .filter(Boolean);
}

const HEADING_PATTERN = /^\s{0,3}#+\s*(.+)$/m;
const FIRST_SENTENCE_PATTERN = /^\s*([^.?!]+?[.?!])/s;

function extractOutlineTitle(content: string): string {
  const heading = content.match(HEADING_PATTERN);
  if (heading) return heading[1].trim();
  const sentence = content.trim().match(FIRST_SENTENCE_PATTERN);
  if (sentence) return sentence[1].trim();
  const line = content.split(/\r?\n/).find((entry) => entry.trim());
  return line?.trim() || "Slide";
}

function splitOutlinesEvenly(outlines: string[], nSections: number): string[][] {
  if (nSections <= 0 || !outlines.length) return [];
  const total = outlines.length;
  const baseSize = Math.floor(total / nSections);
  const remainder = total % nSections;

  const sections: string[][] = [];
  let start = 0;
  for (let index = 0; index < nSections; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    sections.push(outlines.slice(start, start + size));
    start += size;
  }
  return sections;
}

function insertTocOutlines(
  outlines: string[],
  nTocSlides: number,
  titleSlide: boolean,
): string[] {
  if (nTocSlides <= 0) return outlines;

  const insertionIndex = titleSlide ? 1 : 0;
  const outlinesForToc = outlines.slice(insertionIndex);
  if (!outlinesForToc.length) return outlines;

  const sections = splitOutlinesEvenly(outlinesForToc, nTocSlides);
  if (!sections.length) return outlines;

  const tocSlides: string[] = [];
  const outlinesBeforeToc = titleSlide ? 1 : 0;
  let globalOutlineIndex = 0;

  sections.forEach((section, sectionIndex) => {
    const lines = ["## Table of Contents", ""];
    for (const outline of section) {
      const pageNumber =
        outlinesBeforeToc + sections.length + globalOutlineIndex + 1;
      lines.push(`- Page number: ${pageNumber}, Title: ${extractOutlineTitle(outline)}`);
      globalOutlineIndex += 1;
    }
    tocSlides.push(lines.join("\n").trim());
    void sectionIndex;
  });

  const result = [...outlines];
  for (let offset = 0; offset < tocSlides.length; offset += 1) {
    result.splice(insertionIndex + offset, 0, tocSlides[offset]);
  }
  return result;
}

function extractPresentationTitle(outlines: string[]): string {
  if (!outlines.length) return "Untitled Presentation";
  let firstContent = outlines[0] || "";
  if (/^\s*#{1,6}\s*Page\s+\d+\b/.test(firstContent)) {
    firstContent = firstContent.replace(
      /^\s*#{1,6}\s*Page\s+\d+\b[\s,:\-]*/,
      "",
    );
  }
  const cleaned = firstContent
    .replace(/#/g, "")
    .replace(/\//g, "")
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Untitled Presentation";
  if (cleaned.length <= 100) return cleaned;

  const slice = cleaned.slice(0, 100);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 50 ? slice.slice(0, lastSpace) : slice).trim();
}

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const auth = await getAuthStatusFromRequest(request.headers.get("cookie"));
    if (!auth.authenticated) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const presentationId = body.presentation_id;
    let outlines = normalizeOutlines(body.outlines);
    const title = typeof body.title === "string" ? body.title : null;
    const layoutId = typeof body.layout === "string" ? body.layout.trim() : "";

    if (!presentationId) {
      return NextResponse.json(
        { detail: "presentation_id is required" },
        { status: 422 }
      );
    }
    if (outlines.length === 0) {
      return NextResponse.json(
        { detail: "Outlines are required" },
        { status: 400 }
      );
    }
    if (outlines.length > MAX_NUMBER_OF_SLIDES) {
      return NextResponse.json(
        {
          detail: `Number of outlines cannot be greater than ${MAX_NUMBER_OF_SLIDES}`,
        },
        { status: 400 }
      );
    }

    const presentation = await queryOne<any>(
      "SELECT * FROM presentations WHERE id = $1",
      [presentationId]
    );
    if (!presentation) {
      return NextResponse.json(
        { detail: "Presentation not found" },
        { status: 404 }
      );
    }

    if (!layoutId) {
      return NextResponse.json(
        { detail: "Template not selected. Please choose a template." },
        { status: 400 }
      );
    }

    const template = await getTemplateById(layoutId);
    if (!template) {
      return NextResponse.json(
        { detail: "Template not found. Please use a valid template." },
        { status: 400 }
      );
    }

    const payload = normalizeTemplatePayload(template);
    if (!payload.layouts.length) {
      return NextResponse.json(
        { detail: "Template layout must contain at least one slide layout" },
        { status: 400 }
      );
    }

    const layoutModel = buildTemplateLayoutModel(payload);
    if (!layoutModel.slides.length) {
      return NextResponse.json(
        { detail: "Template layout must contain editable slide layouts" },
        { status: 400 }
      );
    }

    let structureSlides = await generatePresentationStructure({
      layout: layoutModel,
      outlines,
      instructions: presentation.instructions,
      sourceContent: presentation.content,
    });
    structureSlides = normalizeStructure(
      structureSlides,
      outlines.length,
      layoutModel.slides.length,
    );

    const includeTitleSlide = presentation.include_title_slide !== false;
    const includeTableOfContents = presentation.include_table_of_contents === true;

    if (includeTitleSlide && structureSlides.length) {
      const titleLayoutIndex = selectTitleSlideLayoutIndex(layoutModel);
      if (titleLayoutIndex !== -1) structureSlides[0] = titleLayoutIndex;
    }

    if (includeTableOfContents) {
      const nTocSlides = getNoOfTocRequiredForNOutlines({
        nOutlines: outlines.length,
        titleSlide: includeTitleSlide,
        targetTotalSlides: presentation.n_slides > 0 ? presentation.n_slides : null,
      });
      const tocLayoutIndex = selectTocOrListSlideLayoutIndex(layoutModel);
      if (tocLayoutIndex !== -1 && nTocSlides > 0) {
        outlines = insertTocOutlines(outlines, nTocSlides, includeTitleSlide);
        structureSlides = insertTocLayouts(
          structureSlides,
          Math.min(nTocSlides, outlines.length),
          includeTitleSlide,
          tocLayoutIndex,
        );
        structureSlides = normalizeStructure(
          structureSlides,
          outlines.length,
          layoutModel.slides.length,
        );
      }
    }

    const layoutPayload = {
      layouts: payload.layouts,
      name: payload.template_id,
      template_id: payload.template_id,
      icon_type: payload.icon_type,
      icon_weight: payload.icon_weight,
    };

    const theme = resolveTemplateTheme({
      theme: template.theme,
      layouts: template.layouts,
    });

    await queryOne(
      `UPDATE presentations
       SET outlines = $1,
           title = COALESCE($2, title),
           n_slides = $3,
           language = '',
           layout = $4,
           structure = $5,
           fonts = $6,
           theme = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [
        JSON.stringify({ slides: outlines.map((content) => ({ content })) }),
        title || extractPresentationTitle(outlines),
        outlines.length,
        JSON.stringify(layoutPayload),
        JSON.stringify({ slides: structureSlides }),
        payload.fonts ? JSON.stringify(payload.fonts) : null,
        JSON.stringify(theme),
        presentationId,
      ]
    );

    // A new outline/structure invalidates any previously generated slides; the
    // stream resumes only when the persisted structure still matches.
    await query("DELETE FROM slides WHERE presentation = $1", [presentationId]);

    return NextResponse.json({ presentation_id: presentationId });
  } catch (err: any) {
    console.error("[Pixa V3 presentation prepare] error:", err);
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

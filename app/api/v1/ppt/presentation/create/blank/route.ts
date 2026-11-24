import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";
import { getTemplateById } from "@/lib/v3/templates";
import crypto from "crypto";

const BLANK_LAYOUT_GROUP = "blank";
const BLANK_LAYOUT_ID = "__blank_slide__";

const BLANK_SLIDE_UI = {
  id: BLANK_LAYOUT_ID,
  description: "Empty slide.",
  background: "#FFFFFF",
  components: [],
  elements: [
    {
      type: "vector",
      shape: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 1280, y: 0 },
        { x: 1280, y: 720 },
        { x: 0, y: 720 },
      ],
      closed: true,
      fill: { color: "#FFFFFF" },
      decorative: true,
    },
  ],
};

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const auth = await getAuthStatusFromRequest(request.headers.get("cookie"));
    if (!auth.authenticated) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    let templateId: string | null = null;
    try {
      const body = await request.json();
      templateId = typeof body?.template_id === "string" ? body.template_id : null;
    } catch {
      templateId = null;
    }

    let template: any = null;
    if (templateId) {
      template = await getTemplateById(templateId).catch(() => null);
      if (!template) {
        return NextResponse.json(
          { detail: "Template not found. Please use a valid template." },
          { status: 400 }
        );
      }
    }

    const presentationId = crypto.randomUUID();
    const slideId = crypto.randomUUID();

    const presentation = await queryOne(
      `INSERT INTO presentations (
         id, owner_id, version, content, n_slides, language, title,
         include_title_slide, created_at, updated_at
       ) VALUES ($1, $2, 'v2', '', 1, 'English', 'Untitled Presentation', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [presentationId, auth.user_id]
    );

    const slide = await queryOne(
      `INSERT INTO slides (id, presentation, owner_id, layout_group, layout, "index", content, html_content, speaker_note, ui)
       VALUES ($1, $2, $3, $4, $5, 0, '{}', NULL, '', $6)
       RETURNING *`,
      [
        slideId,
        presentationId,
        auth.user_id,
        template?.id || BLANK_LAYOUT_GROUP,
        BLANK_LAYOUT_ID,
        JSON.stringify(BLANK_SLIDE_UI),
      ]
    );

    return NextResponse.json(
      {
        ...presentation,
        type: "standard",
        slides: [slide],
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

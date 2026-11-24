import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { query, queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const auth = await getAuthStatusFromRequest(request.headers.get("cookie"));
    if (!auth.authenticated) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const original = await queryOne<any>(
      "SELECT * FROM presentations WHERE id = $1",
      [id]
    );
    if (!original) {
      return NextResponse.json(
        { detail: "Presentation not found" },
        { status: 404 }
      );
    }

    const newId = crypto.randomUUID();
    const title = original.title ? `${original.title} (Copy)` : null;

    const presentation = await queryOne(
      `INSERT INTO presentations (
         id, owner_id, version, content, n_slides, language, title, file_paths,
         outlines, layout, structure, instructions, tone, verbosity,
         include_table_of_contents, include_title_slide, web_search, theme, fonts,
         generation_mode, community_design_ids, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
         $17, $18, $19, $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       )
       RETURNING *`,
      [
        newId,
        auth.user_id,
        original.version,
        original.content,
        original.n_slides,
        original.language,
        title,
        original.file_paths ? JSON.stringify(original.file_paths) : null,
        original.outlines ? JSON.stringify(original.outlines) : null,
        original.layout ? JSON.stringify(original.layout) : null,
        original.structure ? JSON.stringify(original.structure) : null,
        original.instructions,
        original.tone,
        original.verbosity,
        original.include_table_of_contents,
        original.include_title_slide,
        original.web_search,
        original.theme ? JSON.stringify(original.theme) : null,
        original.fonts ? JSON.stringify(original.fonts) : null,
        original.generation_mode,
        original.community_design_ids
          ? JSON.stringify(original.community_design_ids)
          : null,
      ]
    );

    const sourceSlides = (
      await query(
        "SELECT * FROM slides WHERE presentation = $1 ORDER BY \"index\" ASC",
        [id]
      )
    ).rows;

    const slides = [];
    for (const source of sourceSlides) {
      slides.push(
        await queryOne(
          `INSERT INTO slides (id, presentation, owner_id, layout_group, layout, "index", content, html_content, speaker_note, properties, ui)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            crypto.randomUUID(),
            newId,
            auth.user_id,
            source.layout_group,
            source.layout,
            source.index,
            JSON.stringify(source.content ?? {}),
            source.html_content,
            source.speaker_note,
            source.properties ? JSON.stringify(source.properties) : null,
            source.ui ? JSON.stringify(source.ui) : null,
          ]
        )
      );
    }

    return NextResponse.json({ ...presentation, slides });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

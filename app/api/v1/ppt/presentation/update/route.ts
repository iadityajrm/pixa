import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { query, queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";
import { MAX_NUMBER_OF_SLIDES } from "@/utils/presentationLimits";
import crypto from "crypto";

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

export async function PATCH(request: NextRequest) {
  try {
    await ensureSchema();
    const auth = await getAuthStatusFromRequest(request.headers.get("cookie"));
    if (!auth.authenticated) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const id = body.id;
    if (!id) {
      return NextResponse.json({ detail: "id is required" }, { status: 422 });
    }

    const presentation = await queryOne<any>(
      "SELECT id FROM presentations WHERE id = $1",
      [id]
    );
    if (!presentation) {
      return NextResponse.json(
        { detail: "Presentation not found" },
        { status: 404 }
      );
    }

    const nSlides = body.n_slides;
    if (nSlides !== undefined && nSlides !== null) {
      if (!Number.isInteger(nSlides) || nSlides < 1) {
        return NextResponse.json(
          { detail: "Number of slides must be greater than 0" },
          { status: 400 }
        );
      }
      if (nSlides > MAX_NUMBER_OF_SLIDES) {
        return NextResponse.json(
          {
            detail: `Number of slides cannot be greater than ${MAX_NUMBER_OF_SLIDES}`,
          },
          { status: 400 }
        );
      }
    }

    const slides = Array.isArray(body.slides) ? body.slides : null;
    if (slides && slides.length > MAX_NUMBER_OF_SLIDES) {
      return NextResponse.json(
        {
          detail: `Number of slides cannot be greater than ${MAX_NUMBER_OF_SLIDES}`,
        },
        { status: 400 }
      );
    }

    const title = typeof body.title === "string" && body.title ? body.title : null;

    await query(
      `UPDATE presentations
       SET n_slides = COALESCE($1, n_slides),
           title = COALESCE($2, title),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [nSlides ?? null, title, id]
    );

    if (slides && slides.length > 0) {
      await query("DELETE FROM slides WHERE presentation = $1", [id]);
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i] || {};
        const slideId =
          typeof slide.id === "string" && slide.id.length === 36
            ? slide.id
            : crypto.randomUUID();
        await query(
          `INSERT INTO slides
             (id, presentation, owner_id, layout_group, layout, "index", content, html_content, speaker_note, properties, ui)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            slideId,
            id,
            auth.user_id,
            slide.layout_group || "standard",
            slide.layout || "standard_content",
            typeof slide.index === "number" ? slide.index : i,
            JSON.stringify(slide.content ?? {}),
            slide.html_content ?? null,
            slide.speaker_note ?? null,
            slide.properties ? JSON.stringify(slide.properties) : null,
            slide.ui ? JSON.stringify(slide.ui) : null,
          ]
        );
      }
    }

    const updated = await loadPresentationWithSlides(id);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

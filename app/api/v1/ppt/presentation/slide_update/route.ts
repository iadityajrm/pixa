import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest) {
  try {
    await ensureSchema();
    const auth = await getAuthStatusFromRequest(request.headers.get("cookie"));
    if (!auth.authenticated) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const slide = body?.slide;
    if (!slide || typeof slide !== "object") {
      return NextResponse.json({ detail: "slide is required" }, { status: 422 });
    }

    const slideId = typeof slide.id === "string" ? slide.id : "";
    const presentationId =
      typeof slide.presentation === "string" ? slide.presentation : "";
    if (!UUID_PATTERN.test(slideId) || !UUID_PATTERN.test(presentationId)) {
      return NextResponse.json(
        { detail: "Slide and presentation IDs must be valid UUIDs" },
        { status: 422 }
      );
    }

    const stored = await queryOne<any>(
      "SELECT id, presentation FROM slides WHERE id = $1",
      [slideId]
    );
    if (!stored) {
      return NextResponse.json({ detail: "Slide not found" }, { status: 404 });
    }
    if (stored.presentation !== presentationId) {
      return NextResponse.json(
        { detail: "Slide does not belong to the supplied presentation" },
        { status: 400 }
      );
    }

    const updated = await queryOne(
      `UPDATE slides
       SET layout_group = COALESCE($1, layout_group),
           layout = COALESCE($2, layout),
           content = COALESCE($3, content),
           html_content = $4,
           speaker_note = $5,
           properties = $6,
           ui = $7
       WHERE id = $8
       RETURNING *`,
      [
        slide.layout_group ?? null,
        slide.layout ?? null,
        slide.content !== undefined ? JSON.stringify(slide.content) : null,
        slide.html_content ?? null,
        slide.speaker_note ?? null,
        slide.properties ? JSON.stringify(slide.properties) : null,
        slide.ui ? JSON.stringify(slide.ui) : null,
        slideId,
      ]
    );

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

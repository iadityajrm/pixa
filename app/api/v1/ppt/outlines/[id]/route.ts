import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/v3/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = await queryOne<{ outlines: any }>(
      "SELECT outlines FROM presentations WHERE id = $1",
      [id]
    );

    if (!row) {
      return NextResponse.json({ detail: "Presentation not found" }, { status: 404 });
    }

    return NextResponse.json(row.outlines || { slides: [] });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const slides = Array.isArray(body.slides) ? body.slides : [];
    const title = slides[0]?.title || null;

    const row = await queryOne(
      `UPDATE presentations
       SET outlines = $1, n_slides = $2, title = COALESCE(title, $3), updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING outlines`,
      [JSON.stringify(body), slides.length, title, id]
    );

    return NextResponse.json(row?.outlines || body);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

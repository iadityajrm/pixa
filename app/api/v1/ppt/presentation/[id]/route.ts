import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/v3/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const presentation = await queryOne(
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

    if (!presentation) {
      return NextResponse.json({ detail: "Presentation not found" }, { status: 404 });
    }

    return NextResponse.json(presentation);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await query("DELETE FROM presentations WHERE id = $1", [id]);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

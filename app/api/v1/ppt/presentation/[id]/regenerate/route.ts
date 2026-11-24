import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { query, queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";

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
    const presentation = await queryOne<any>(
      "SELECT id, generation_mode FROM presentations WHERE id = $1",
      [id]
    );
    if (!presentation) {
      return NextResponse.json(
        { detail: "Presentation not found" },
        { status: 404 }
      );
    }
    if (presentation.generation_mode === "smart") {
      return NextResponse.json(
        {
          detail:
            "Smart presentations can no longer be regenerated. Create a new standard presentation instead.",
        },
        { status: 400 }
      );
    }

    await query("DELETE FROM slides WHERE presentation = $1", [id]);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

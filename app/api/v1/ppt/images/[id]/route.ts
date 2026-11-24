import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { query, queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";
import { StorageService } from "@/lib/v3/storage";

export async function GET(
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
    const row = await queryOne<any>("SELECT * FROM imageasset WHERE id = $1", [id]);
    if (!row) {
      return NextResponse.json({ detail: "Image not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      path: row.path,
      file_url: row.path,
      is_uploaded: row.is_uploaded,
      created_at: row.created_at,
      extras: row.extras,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function DELETE(
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
    const row = await queryOne<any>(
      "DELETE FROM imageasset WHERE id = $1 AND ($2::uuid IS NULL OR owner_id = $2::uuid) RETURNING path",
      [id, auth.user_id]
    );
    if (!row) {
      return NextResponse.json({ detail: "Image not found" }, { status: 404 });
    }

    if (row.path) {
      await StorageService.delete(row.path);
    }

    return NextResponse.json({ success: true, message: "Image deleted" });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

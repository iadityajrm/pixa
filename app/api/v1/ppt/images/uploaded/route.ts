import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { query } from "@/lib/v3/db";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const rows = (
      await query(
        `SELECT * FROM imageasset
         WHERE is_uploaded = true AND ($1::uuid IS NULL OR owner_id = $1::uuid)
         ORDER BY created_at DESC`,
        [auth.user_id]
      )
    ).rows;

    return NextResponse.json(
      rows.map((r: any) => ({
        id: r.id,
        path: r.path,
        file_url: r.path,
        is_uploaded: true,
        created_at: r.created_at,
        extras: r.extras,
      }))
    );
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

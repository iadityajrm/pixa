import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { query } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";

export async function GET(request: NextRequest) {
  try {
    await ensureSchema();
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const presentations = (
      await query(
        `SELECT p.*,
                COALESCE(
                  json_agg(s.* ORDER BY s.index ASC) FILTER (WHERE s.id IS NOT NULL),
                  '[]'
                ) as slides
         FROM presentations p
         LEFT JOIN slides s ON s.presentation = p.id
         WHERE ($1::uuid IS NULL OR p.owner_id = $1::uuid OR $2::boolean = true)
         GROUP BY p.id
         ORDER BY p.updated_at DESC`,
        [auth.user_id, auth.role === "admin"]
      )
    ).rows;

    return NextResponse.json(presentations);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

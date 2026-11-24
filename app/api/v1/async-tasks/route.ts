import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";

export async function GET(request: NextRequest) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const createdAt = searchParams.get("created_at") || searchParams.get("created_at_from");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (type) {
      conditions.push(`type = $${idx++}`);
      values.push(type);
    }
    if (status) {
      conditions.push(`status = $${idx++}`);
      values.push(status);
    }
    if (createdAt) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(new Date(createdAt).toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT * FROM async_task ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    values.push(limit, offset);

    const result = await query(sql, values);
    return NextResponse.json(result.rows || []);
  } catch (err: any) {
    console.error("Failed to list async tasks", err);
    return NextResponse.json([], { status: 200 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { query, queryOne } from "@/lib/v3/db";
import {
  normalizeProvider,
  SUPPORTED_LLM_PROVIDERS,
} from "@/lib/v3/services/adminKeyPoolService";

async function requireAdmin(request: NextRequest) {
  const auth = await getAuthStatusFromRequest(request.headers.get("cookie"));
  if (!auth.authenticated || auth.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }
  return null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const provider = body.provider ? normalizeProvider(body.provider) : null;
    if (provider && !SUPPORTED_LLM_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { detail: `Unsupported provider '${body.provider}'. Use Groq or Qwen.` },
        { status: 400 }
      );
    }

    const updated = await queryOne(
      `UPDATE admin_api_keys SET
         provider = COALESCE($2, provider),
         label = COALESCE($3, label),
         status = COALESCE($4, status),
         allow_sharing = COALESCE($5, allow_sharing),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        provider,
        typeof body.label === "string" ? body.label.trim() || null : null,
        typeof body.status === "string" ? body.status : null,
        typeof body.allow_sharing === "boolean" ? body.allow_sharing : null,
      ]
    );

    if (!updated) {
      return NextResponse.json({ detail: "Key not found" }, { status: 404 });
    }

    if (provider) {
      await query(
        "UPDATE admin_api_key_assignments SET provider = $2 WHERE key_id = $1",
        [id, provider]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    await query("DELETE FROM admin_api_key_assignments WHERE key_id = $1", [id]);
    const deleted = await queryOne(
      "DELETE FROM admin_api_keys WHERE id = $1 RETURNING id",
      [id]
    );
    if (!deleted) {
      return NextResponse.json({ detail: "Key not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const keyValue = (body.key_value || "").trim();
    if (!keyValue) {
      return NextResponse.json({ detail: "API key value is required" }, { status: 400 });
    }

    const updated = await queryOne(
      `UPDATE admin_api_keys
       SET key_value = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [id, keyValue]
    );
    if (!updated) {
      return NextResponse.json({ detail: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

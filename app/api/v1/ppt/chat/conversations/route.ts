import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";

export async function GET(request: NextRequest) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const presentationId = searchParams.get("presentation_id");

    if (!presentationId) {
      return NextResponse.json({ detail: "presentation_id is required" }, { status: 400 });
    }

    const rows = (
      await query(
        `SELECT DISTINCT ON (conversation_id) conversation_id, created_at, content
         FROM chat_history_messages
         WHERE presentation_id = $1
         ORDER BY conversation_id, created_at DESC`,
        [presentationId]
      )
    ).rows;

    const conversations = rows.map((r: any) => ({
      conversation_id: r.conversation_id,
      updated_at: r.created_at,
      last_message_preview: r.content ? r.content.slice(0, 100) : null,
    }));

    return NextResponse.json(conversations);
  } catch (err: any) {
    console.error("Error listing chat conversations:", err);
    return NextResponse.json([], { status: 200 });
  }
}

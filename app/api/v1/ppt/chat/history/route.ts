import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";

export async function GET(request: NextRequest) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const presentationId = searchParams.get("presentation_id");
    const conversationId = searchParams.get("conversation_id");

    if (!presentationId || !conversationId) {
      return NextResponse.json(
        { detail: "presentation_id and conversation_id are required" },
        { status: 400 }
      );
    }

    const rows = (
      await query(
        `SELECT content, created_at, position
         FROM chat_history_messages
         WHERE presentation_id = $1 AND conversation_id = $2
         ORDER BY position ASC, created_at ASC`,
        [presentationId, conversationId]
      )
    ).rows;

    const messages = rows.map((r: any) => {
      let role = "assistant";
      let text = r.content;
      try {
        const parsed = JSON.parse(r.content);
        if (parsed.role) role = parsed.role;
        if (parsed.content) text = parsed.content;
      } catch {}
      return {
        role,
        content: text,
        created_at: r.created_at,
      };
    });

    return NextResponse.json({
      presentation_id: presentationId,
      conversation_id: conversationId,
      messages,
    });
  } catch (err: any) {
    console.error("Error getting chat history:", err);
    return NextResponse.json(
      { presentation_id: "", conversation_id: "", messages: [] },
      { status: 200 }
    );
  }
}

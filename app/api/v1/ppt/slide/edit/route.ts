import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/v3/db";
import { callLLMChatCompletion } from "@/lib/v3/services/llmService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slideId = body.id;
    const prompt = body.prompt;

    if (!slideId || !prompt) {
      return NextResponse.json({ detail: "id and prompt are required" }, { status: 400 });
    }

    const slide = await queryOne<any>("SELECT * FROM slides WHERE id = $1", [slideId]);
    if (!slide) {
      return NextResponse.json({ detail: "Slide not found" }, { status: 404 });
    }

    const currentContent = slide.content || {};
    const systemPrompt = `You are an expert presentation editor. Given the current slide content and user edit instruction, return the updated JSON content.
Current Content: ${JSON.stringify(currentContent)}
Return only valid JSON.`;

    const { text } = await callLLMChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ]);

    let updatedContent = currentContent;
    try {
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      updatedContent = { ...currentContent, ...JSON.parse(cleaned) };
    } catch {
      updatedContent = { ...currentContent, paragraph: prompt };
    }

    const updatedSlide = await queryOne(
      `UPDATE slides
       SET content = $1
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(updatedContent), slideId]
    );

    return NextResponse.json(updatedSlide);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

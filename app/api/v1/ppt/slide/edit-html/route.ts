import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/v3/db";
import { callLLMChatCompletion } from "@/lib/v3/services/llmService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slideId = body.id;
    const prompt = body.prompt;
    const html = body.html;

    if (!slideId || !prompt) {
      return NextResponse.json({ detail: "id and prompt are required" }, { status: 400 });
    }

    const slide = await queryOne<any>("SELECT * FROM slides WHERE id = $1", [slideId]);
    if (!slide) {
      return NextResponse.json({ detail: "Slide not found" }, { status: 404 });
    }

    const currentHtml = html || slide.html_content || "";
    const systemPrompt = `You are a Tailwind CSS and HTML expert. Modify the slide HTML based on user request. Maintain clean 1280x720 16:9 layout. Return ONLY clean HTML.`;

    const { text } = await callLLMChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Slide HTML:\n${currentHtml}\n\nInstruction:\n${prompt}` },
    ]);

    const cleaned = text.replace(/```html/g, "").replace(/```/g, "").trim();

    const updatedSlide = await queryOne(
      `UPDATE slides
       SET html_content = $1
       WHERE id = $2
       RETURNING *`,
      [cleaned, slideId]
    );

    return NextResponse.json(updatedSlide);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

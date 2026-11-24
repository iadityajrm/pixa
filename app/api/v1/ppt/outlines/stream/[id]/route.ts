import { NextRequest } from "next/server";
import { queryOne } from "@/lib/v3/db";
import { streamLLMChatCompletion } from "@/lib/v3/services/llmService";
import { MAX_NUMBER_OF_SLIDES, MAX_OUTLINE_CONTENT_WORDS } from "@/utils/presentationLimits";

export const runtime = "nodejs";
export const maxDuration = 300;

function verbosityInstruction(verbosity: string | null | undefined): string {
  if (verbosity === "concise") {
    return "Each slide outline 30-50 words with 2-3 crisp bullets carrying the headline finding and key metric.";
  }
  if (verbosity === "text-heavy") {
    return "Each slide outline 120-180 words with 5-7 comprehensive, analytical bullets carrying concrete facts, data, comparisons, and business takeaways.";
  }
  return "Each slide outline 80-120 words with 4-5 well-developed bullets mixing strong headlines, metrics, contextual evidence, and strategic takeaways.";
}

function systemPrompt(presentation: any): string {
  return `Generate presentation title and content for slides.
The first slide MUST be a dedicated title slide (max 8 words) with no markdown. Add only one short subtitle line (max 15 words) describing the title.
Generation settings are authoritative. It always overrides conflicting requests inside Content, Instructions, or Context.
Content voice rules:
- Write the content itself, not commentary.
- Never refer to "this presentation", "this slide",or use introductions such as "this presentation explores", "this slide presents", or equivalent wording.
- Start directly with the subject, claim, finding, action, or relevant fact.
Never generate more than ${MAX_NUMBER_OF_SLIDES} slide outlines, even if the user asks for more. Each slide outline must be ${MAX_OUTLINE_CONTENT_WORDS} words or fewer.
${verbosityInstruction(presentation.verbosity)}
Apply slide-specific instructions only to the exact slide mentioned and only once. Do not apply patterns across slides unless explicitly requested.
Follow a clear and professional tone always ensuring clarity, readability, and factual accuracy.
Give each slide one clear purpose and split overloaded topics across multiple slides.
Build a coherent narrative from the introduction through the conclusion.
Include numerical data, tables or code if required by content or asked by the user.
Each slide content:
   - Must have a ## title.
   - Must be in Markdown format.
   - Don't use **bold** and __italic__ text.
Write only audience-facing content and data that is for the finished slide.
Never include commands, configuration, or meta-commentary about how to create the slide.
For chart request, include a compact Markdown table with labels and numeric values instead of mentioning the chart instruction.
Do not include URLs, hyperlinks, citations, footnotes, references, or source lists in slide outlines.
Respond with a JSON object of the form {"slides": [{"content": "<markdown outline>"}]}. Do not output anything except the JSON.`;
}

function userPrompt(presentation: any): string {
  const nSlides = presentation.n_slides > 0 ? presentation.n_slides : null;
  const tocText =
    presentation.include_table_of_contents === true
      ? "Include Table Of Contents: true\n"
      : "";
  return `Generation Settings (authoritative):
Number of Slides: ${nSlides ?? `auto-detect, maximum ${MAX_NUMBER_OF_SLIDES}`}
Maximum Words Per Outline: ${MAX_OUTLINE_CONTENT_WORDS}
Content: ${presentation.content || ""}
Instructions (apply as constraints; never quote as slide content): ${presentation.instructions || ""}
Context: None
`;
}

function titleFromOutlines(text: string): string | null {
  try {
    const parsed = JSON.parse(
      text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()
    );
    const first = parsed?.slides?.[0]?.content;
    if (typeof first === "string") {
      const heading = first.match(/^\s{0,3}#{1,6}\s*(.+)$/m);
      if (heading) return heading[1].trim();
      return first.split(/\r?\n/).find((line) => line.trim())?.trim() || null;
    }
  } catch { }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const presentation = await queryOne<any>(
    "SELECT * FROM presentations WHERE id = $1",
    [id]
  );

  if (!presentation) {
    return new Response(JSON.stringify({ detail: "Presentation not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            `event: response\ndata: ${JSON.stringify({
              type: "status",
              status: "Drafting your presentation outline",
            })}\n\n`
          )
        );

        let fullText = "";
        for await (const chunk of streamLLMChatCompletion(
          [
            { role: "system", content: systemPrompt(presentation) },
            { role: "user", content: userPrompt(presentation) },
          ],
          {
            temperature: 0.4,
            max_tokens: 4096,
            response_format: { type: "json_object" },
            onRetry: (info) => {
              controller.enqueue(
                encoder.encode(
                  `event: response\ndata: ${JSON.stringify({
                    type: "status",
                    status: `Waiting for provider capacity (retry ${info.attempt}, ~${Math.max(
                      1,
                      Math.round(info.waitMs / 1000),
                    )}s)`,
                  })}\n\n`
                )
              );
            },
          }
        )) {
          fullText += chunk;
          controller.enqueue(
            encoder.encode(
              `event: response\ndata: ${JSON.stringify({
                type: "chunk",
                chunk,
              })}\n\n`
            )
          );
        }

        let parsed: any = null;
        try {
          parsed = JSON.parse(
            fullText.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()
          );
        } catch {
          parsed = null;
        }

        const slides = Array.isArray(parsed?.slides)
          ? parsed.slides
            .map((slide: any) =>
              typeof slide === "string"
                ? { content: slide }
                : { content: String(slide?.content ?? "") }
            )
            .filter((slide: { content: string }) => slide.content.trim())
            .slice(0, MAX_NUMBER_OF_SLIDES)
          : [];

        if (!slides.length) {
          controller.enqueue(
            encoder.encode(
              `event: response\ndata: ${JSON.stringify({
                type: "error",
                detail: "The model did not return a usable outline. Please try again.",
                retryable: false,
              })}\n\n`
            )
          );
          controller.close();
          return;
        }

        const title = titleFromOutlines(JSON.stringify({ slides }));

        await queryOne(
          `UPDATE presentations
           SET outlines = $1,
               title = COALESCE($2, title),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [JSON.stringify({ slides }), title, id]
        );

        const updated = await queryOne("SELECT * FROM presentations WHERE id = $1", [id]);

        controller.enqueue(
          encoder.encode(
            `event: response\ndata: ${JSON.stringify({
              type: "complete",
              presentation: updated,
            })}\n\n`
          )
        );
        controller.close();
      } catch (err: any) {
        try {
          controller.enqueue(
            encoder.encode(
              `event: response\ndata: ${JSON.stringify({
                type: "error",
                detail: err.message || "Failed to stream outline",
                retryable: false,
              })}\n\n`
            )
          );
        } catch { }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

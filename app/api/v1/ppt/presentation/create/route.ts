import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";
import { checkAndReserveGenerationCredits } from "@/lib/v3/services/creditService";
import { MAX_NUMBER_OF_SLIDES } from "@/utils/presentationLimits";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const content = body.content || "";
    const requestedSlides = Number.parseInt(body.n_slides || "10", 10);
    const nSlides =
      Number.isFinite(requestedSlides) && requestedSlides > 0
        ? Math.min(requestedSlides, MAX_NUMBER_OF_SLIDES)
        : 10;
    const language = body.language || "en";
    const title = body.title || null;
    const instructions = body.instructions || null;
    const tone = body.tone || null;
    const verbosity = body.verbosity || null;
    const generationMode = "standard";
    const includeTOC = Boolean(body.include_table_of_contents);
    const includeTitle = body.include_title_slide !== false;
    const webSearch = Boolean(body.web_search);

    const presentationId = crypto.randomUUID();

    let isFree = true;
    let creditsCharged = 0;
    if (auth.user_id) {
      const creditRes = await checkAndReserveGenerationCredits(
        auth.user_id,
        nSlides,
        presentationId
      );
      isFree = creditRes.isFree;
      creditsCharged = creditRes.creditsCharged;
    }

    const row = await queryOne(
      `INSERT INTO presentations (
        id, owner_id, version, content, n_slides, language, title, instructions, tone, verbosity,
        generation_mode, include_table_of_contents, include_title_slide, web_search,
        credits_charged, is_free_generation, created_at, updated_at
      ) VALUES (
        $1, $2, 'v2', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *`,
      [
        presentationId,
        auth.user_id,
        content,
        nSlides,
        language,
        title,
        instructions,
        tone,
        verbosity,
        generationMode,
        includeTOC,
        includeTitle,
        webSearch,
        creditsCharged,
        isFree,
      ]
    );

    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message },
      { status: err.statusCode || 500 }
    );
  }
}

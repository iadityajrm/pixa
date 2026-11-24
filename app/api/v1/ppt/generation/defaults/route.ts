import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.json({
    default_max_output_tokens: 4096,
    model_max_output_tokens: 8192,
  });
}

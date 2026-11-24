import { NextResponse } from "next/server";

// Smart generation has been removed in favor of the standard template pipeline.
export async function POST() {
  return NextResponse.json(
    {
      detail:
        "Smart generation is no longer available. Use the standard presentation flow.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return POST();
}

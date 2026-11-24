import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    items: [],
    total: 0,
    page: 1,
    page_size: 8,
  });
}

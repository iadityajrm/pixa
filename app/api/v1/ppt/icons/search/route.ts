import { NextRequest, NextResponse } from "next/server";
import { searchIcons } from "@/lib/v3/services/iconSearchService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const iconType = searchParams.get("icon_type") || searchParams.get("icon_weight") || "regular";

    const results = await searchIcons(query, limit, iconType);
    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

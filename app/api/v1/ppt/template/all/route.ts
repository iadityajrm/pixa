import { NextRequest, NextResponse } from "next/server";
import { listAllTemplates } from "@/lib/v3/templates";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const defaultParam = searchParams.get("default");
    const pageSize = parseInt(searchParams.get("page_size") || "20", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);

    let templates = await listAllTemplates();

    if (defaultParam !== null && defaultParam !== undefined) {
      const isDefault = defaultParam === "true";
      templates = templates.filter((t) => Boolean(t.is_default) === isDefault);
    }

    const total = templates.length;
    const offset = (page - 1) * pageSize;
    const items = templates.slice(offset, offset + pageSize);

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

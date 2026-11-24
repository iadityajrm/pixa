import { NextRequest, NextResponse } from "next/server";
import { getTemplateById } from "@/lib/v3/templates";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await getTemplateById(id);
    if (!template) {
      return NextResponse.json({ detail: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const filePaths = body.file_paths || [];

    const response = filePaths.map((fp: string) => ({
      name: fp.split("/").pop() || "document.txt",
      file_path: fp,
    }));

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

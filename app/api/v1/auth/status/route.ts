import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const status = await getAuthStatusFromRequest(cookieHeader);
    return NextResponse.json(status);
  } catch (err: any) {
    console.error("[Pixa V3 Auth Status] Error:", err);
    return NextResponse.json(
      { configured: true, authenticated: false, error: err.message },
      { status: 500 }
    );
  }
}

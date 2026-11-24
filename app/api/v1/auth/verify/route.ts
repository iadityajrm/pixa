import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest, getUserFromSessionCookie } from "@/lib/v3/auth";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const status = await getAuthStatusFromRequest(cookieHeader);
    if (!status.authenticated) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    let sessionToken: string | null = null;
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)presenton_session=([^;]+)/);
      if (match?.[1]) sessionToken = decodeURIComponent(match[1]);
    }
    const user = await getUserFromSessionCookie(sessionToken);

    return NextResponse.json({
      authenticated: true,
      id: user?.id,
      username: user?.username,
      role: user?.is_superuser ? "admin" : "user",
      credits: user?.credits ?? 0,
      free_presentation_used: user?.free_presentation_used ?? false,
      has_purchased_credits: user?.has_purchased_credits ?? false,
      method: "session",
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

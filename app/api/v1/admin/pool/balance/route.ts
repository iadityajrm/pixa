import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { balanceKeyAssignments, getActiveProvider } from "@/lib/v3/services/adminKeyPoolService";

/**
 * Re-distribute every active account across the active provider keys as evenly
 * as possible. This is the "rotate" action administrators use after adding keys.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || auth.role !== "admin") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const result = await balanceKeyAssignments(await getActiveProvider());

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

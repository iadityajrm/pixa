import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { balanceKeyAssignments, getActiveProvider } from "@/lib/v3/services/adminKeyPoolService";

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || auth.role !== "admin") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const activeProvider = await getActiveProvider();
    const result = await balanceKeyAssignments(activeProvider);

    return NextResponse.json({
      success: true,
      provider: result.provider,
      assigned: result.assigned,
      assigned_count: result.assigned,
      missing: result.total_keys > 0
        ? Math.max(0, result.total_users - result.assigned)
        : result.total_users,
      total_users: result.total_users,
      total_keys: result.total_keys,
      distribution: result.distribution,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

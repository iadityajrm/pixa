import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { assignKeyToUser, getActiveProvider } from "@/lib/v3/services/adminKeyPoolService";
import { queryOne } from "@/lib/v3/db";

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || auth.role !== "admin") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const userId = body.user_id;
    if (!userId) {
      return NextResponse.json({ detail: "user_id is required" }, { status: 400 });
    }

    const user = await queryOne('SELECT * FROM "user" WHERE id = $1', [userId]);
    if (!user) {
      return NextResponse.json({ detail: "User not found" }, { status: 404 });
    }

    const activeProvider = await getActiveProvider();
    const key = await assignKeyToUser(userId, activeProvider);
    if (!key) {
      return NextResponse.json(
        {
          detail: `No unassigned API key is available for provider '${activeProvider}'. Add one to the pool first.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      user_id: user.id,
      username: user.username,
      provider: key.provider,
      key_id: key.id,
      masked_key: `${key.key_value.slice(0, 4)}...${key.key_value.slice(-4)}`,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

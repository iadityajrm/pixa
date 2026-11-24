import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { getUserCreditStatus } from "@/lib/v3/services/creditService";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || !auth.user_id) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const status = await getUserCreditStatus(auth.user_id);
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

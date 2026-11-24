import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { purchaseCredits } from "@/lib/v3/services/creditService";

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || !auth.user_id) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const planId = body.plan_id;
    const paymentReference = body.payment_reference;

    if (!planId) {
      return NextResponse.json({ detail: "plan_id is required" }, { status: 400 });
    }

    const result = await purchaseCredits(auth.user_id, planId, paymentReference);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 400 });
  }
}

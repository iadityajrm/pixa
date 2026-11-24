import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { query } from "@/lib/v3/db";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || !auth.user_id) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);

    const rows = (
      await query(
        `SELECT id, type, amount, balance_after, plan_id, price_inr, reference_id, description, created_at
         FROM credit_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [auth.user_id, limit]
      )
    ).rows;

    const data = rows.map((tx: any) => ({
      id: String(tx.id),
      type: tx.type,
      amount: tx.amount,
      balance_after: tx.balance_after,
      plan_id: tx.plan_id || null,
      price_inr: tx.price_inr || null,
      reference_id: tx.reference_id || null,
      description: tx.description,
      created_at: tx.created_at ? new Date(tx.created_at).toISOString() : "",
    }));

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { queryOne, transaction } from "@/lib/v3/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthStatusFromRequest(request.headers.get("cookie"));
    if (!auth.authenticated || auth.role !== "admin") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount === 0) {
      return NextResponse.json(
        { detail: "amount must be a non-zero whole number" },
        { status: 422 }
      );
    }

    const user = await queryOne<{ id: string; username: string; credits: number }>(
      'SELECT id, username, credits FROM "user" WHERE id = $1',
      [id]
    );
    if (!user) {
      return NextResponse.json({ detail: "User not found" }, { status: 404 });
    }

    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : `Admin manual adjustment (${amount >= 0 ? "+" : ""}${amount})`;

    const result = await transaction(async (client) => {
      const updated = await client.query(
        'UPDATE "user" SET credits = GREATEST(0, credits + $1) WHERE id = $2 RETURNING credits',
        [amount, id]
      );
      const credits = updated.rows[0]?.credits ?? user.credits;
      await client.query(
        `INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
         VALUES ($1, 'adjustment', $2, $3, $4)`,
        [id, amount, credits, description]
      );
      return credits;
    });

    return NextResponse.json({
      success: true,
      user_id: id,
      username: user.username,
      credits: result,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

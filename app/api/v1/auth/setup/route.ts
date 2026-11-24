import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";
import { hashPassword, V3User } from "@/lib/v3/auth";

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const countRes = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM "user"');
    if (parseInt(countRes?.count || "0", 10) > 0) {
      return NextResponse.json({ detail: "Credentials already configured" }, { status: 409 });
    }

    const body = await request.json();
    const username = (body.username || "").trim();
    const password = body.password || "";

    if (username.length < 3) {
      return NextResponse.json(
        { detail: "Username must be at least 3 characters" },
        { status: 422 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { detail: "Password must be at least 6 characters" },
        { status: 422 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const user = await queryOne<V3User>(
      `INSERT INTO "user" (username, hashed_password, is_active, is_verified, is_superuser, admin_slot, auth_version, credits, has_purchased_credits)
       VALUES ($1, $2, true, true, true, 'primary', 1, 9999, true)
       RETURNING *`,
      [username, hashedPassword]
    );

    return NextResponse.json({
      configured: true,
      authenticated: false,
      username: user?.username,
      role: "admin",
    });
  } catch (err: any) {
    console.error("[Pixa V3 Auth Setup] Error:", err);
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

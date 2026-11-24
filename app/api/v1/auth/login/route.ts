import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  signSessionJwt,
  verifyPassword,
  V3User,
} from "@/lib/v3/auth";
import { assignKeyToUser } from "@/lib/v3/services/adminKeyPoolService";

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const countRes = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM "user"');
    if (parseInt(countRes?.count || "0", 10) === 0) {
      return NextResponse.json({ detail: "Login setup is required" }, { status: 428 });
    }

    const body = await request.json();
    const username = (body.username || "").trim();
    const password = body.password || "";

    const user = await queryOne<V3User>(
      'SELECT * FROM "user" WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (!user || !user.is_active) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.hashed_password);
    if (!isValid) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    // Attempt pool key assignment if missing
    try {
      await assignKeyToUser(user.id);
    } catch {}

    const token = signSessionJwt(user);
    const response = NextResponse.json({
      configured: true,
      authenticated: true,
      id: user.id,
      username: user.username,
      role: user.is_superuser ? "admin" : "user",
      credits: user.credits,
      free_presentation_used: user.free_presentation_used,
      has_purchased_credits: user.has_purchased_credits,
    });

    const isSecure =
      request.headers.get("x-forwarded-proto")?.toLowerCase() === "https" ||
      request.nextUrl.protocol === "https:";

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      maxAge: SESSION_TTL_SECONDS,
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("[Pixa V3 Login] Error:", err);
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

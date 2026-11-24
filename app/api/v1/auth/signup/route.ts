import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/v3/db";
import { ensureSchema } from "@/lib/v3/db/schema";
import {
  hashPassword,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  signSessionJwt,
  V3User,
} from "@/lib/v3/auth";
import { assignKeyToUser } from "@/lib/v3/services/adminKeyPoolService";

export async function POST(request: NextRequest) {
  try {
    await ensureSchema();
    const body = await request.json();
    const username = (body.username || "").trim();
    const password = body.password || "";

    if (username.length < 3) {
      return NextResponse.json(
        { detail: "Email/Username must be at least 3 characters" },
        { status: 422 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { detail: "Password must be at least 6 characters" },
        { status: 422 }
      );
    }

    const existing = await queryOne(
      'SELECT id FROM "user" WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    if (existing) {
      return NextResponse.json(
        { detail: "An account with this email/username already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const user = await queryOne<V3User>(
      `INSERT INTO "user" (username, hashed_password, is_active, is_verified, is_superuser, auth_version, credits, free_presentation_used, has_purchased_credits)
       VALUES ($1, $2, true, true, false, 1, 0, false, false)
       RETURNING *`,
      [username, hashedPassword]
    );

    if (!user) {
      throw new Error("Failed to create user account");
    }

    try {
      await assignKeyToUser(user.id);
    } catch {}

    const token = signSessionJwt(user);
    const response = NextResponse.json({
      configured: true,
      authenticated: true,
      id: user.id,
      username: user.username,
      role: "user",
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
    console.error("[Pixa V3 Signup] Error:", err);
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

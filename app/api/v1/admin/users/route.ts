import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest, hashPassword, V3User } from "@/lib/v3/auth";
import { query, queryOne } from "@/lib/v3/db";
import { assignKeyToUser } from "@/lib/v3/services/adminKeyPoolService";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || auth.role !== "admin") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const rows = (
      await query(
        `SELECT id, username, is_superuser, credits, free_presentation_used, has_purchased_credits, created_at
         FROM "user"
         ORDER BY created_at DESC, username ASC`
      )
    ).rows;

    const users = rows.map((u: any) => ({
      id: String(u.id),
      username: u.username,
      role: u.is_superuser ? "admin" : "user",
      credits: u.credits || 0,
      free_presentation_used: Boolean(u.free_presentation_used),
      has_purchased_credits: Boolean(u.has_purchased_credits),
      created_at: u.created_at ? new Date(u.created_at).toISOString() : null,
    }));

    return NextResponse.json(users);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || auth.role !== "admin") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
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

    const existing = await queryOne(
      'SELECT id FROM "user" WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    if (existing) {
      return NextResponse.json(
        { detail: "Username already exists" },
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

    if (user) {
      try {
        await assignKeyToUser(user.id);
      } catch {
        // A missing pool key must not block account creation; retried on login.
      }
    }

    return NextResponse.json(
      {
        id: user?.id,
        username: user?.username,
        role: "user",
        credits: user?.credits ?? 0,
        free_presentation_used: user?.free_presentation_used ?? false,
        has_purchased_credits: user?.has_purchased_credits ?? false,
        created_at: user?.created_at,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

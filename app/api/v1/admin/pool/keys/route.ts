import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { query, queryOne } from "@/lib/v3/db";
import {
  assignKeyToUser,
  getActiveProvider,
  normalizeProvider,
  SUPPORTED_LLM_PROVIDERS,
} from "@/lib/v3/services/adminKeyPoolService";
import crypto from "crypto";

function maskKey(key: string): string {
  const raw = key || "";
  return raw.length > 8 ? `${raw.slice(0, 4)}...${raw.slice(-4)}` : "***";
}

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || auth.role !== "admin") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const rows = (
      await query(
        `SELECT k.*,
                COALESCE(
                  ARRAY_AGG(u.username ORDER BY u.username) FILTER (WHERE u.username IS NOT NULL),
                  '{}'
                ) AS assigned_usernames,
                COUNT(u.username)::int AS assigned_count
         FROM admin_api_keys k
         LEFT JOIN admin_api_key_assignments a ON a.key_id = k.id
         LEFT JOIN "user" u ON u.id::text = a.user_id
         GROUP BY k.id
         ORDER BY k.created_at DESC`
      )
    ).rows;

    const data = rows.map((k: any) => {
      const usernames: string[] = Array.isArray(k.assigned_usernames)
        ? k.assigned_usernames
        : [];
      return {
        id: k.id,
        provider: k.provider,
        label: k.label,
        status: k.status,
        assigned_user_id: usernames.length > 0 ? usernames[0] : null,
        assigned_username: usernames.length > 0 ? usernames[0] : null,
        assigned_usernames: usernames,
        assigned_count: Number(k.assigned_count) || 0,
        allow_sharing: Boolean(k.allow_sharing),
        masked_key: maskKey(k.key_value),
        created_at: k.created_at ? new Date(k.created_at).toISOString() : "",
        updated_at: k.updated_at ? new Date(k.updated_at).toISOString() : "",
      };
    });

    return NextResponse.json(data);
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
    const provider = normalizeProvider(body.provider || "");
    const keyValue = (body.key_value || "").trim();
    const label = (body.label || "Provider Key").trim();
    const allowSharing = Boolean(body.allow_sharing);

    if (!SUPPORTED_LLM_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { detail: `Unsupported provider '${body.provider}'. Use Groq or Qwen.` },
        { status: 400 }
      );
    }
    if (!keyValue) {
      return NextResponse.json(
        { detail: "API key value is required" },
        { status: 400 }
      );
    }

    const id = `apk_${crypto.randomBytes(8).toString("hex")}`;
    const row = await queryOne(
      `INSERT INTO admin_api_keys (id, provider, key_value, label, status, allow_sharing, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [id, provider, keyValue, label, allowSharing]
    );

    // Newly added keys should cover accounts that were still waiting for one.
    const activeProvider = await getActiveProvider();
    if (normalizeProvider(provider) === activeProvider) {
      const missing = (
        await query(
          `SELECT u.id FROM "user" u
           LEFT JOIN admin_api_key_assignments a ON a.user_id = u.id::text AND a.provider = $1
           LEFT JOIN admin_api_keys k ON k.id = a.key_id AND k.provider = $1 AND k.status = 'active'
           WHERE k.id IS NULL AND u.is_active = true`,
          [activeProvider]
        )
      ).rows;
      for (const user of missing) {
        await assignKeyToUser(String(user.id), activeProvider);
      }
    }

    return NextResponse.json(
      {
        id: row.id,
        provider: row.provider,
        label: row.label,
        status: row.status,
        assigned_user_id: null,
        assigned_username: null,
        assigned_usernames: [],
        assigned_count: 0,
        allow_sharing: Boolean(row.allow_sharing),
        masked_key: maskKey(row.key_value),
        created_at: new Date(row.created_at).toISOString(),
        updated_at: new Date(row.updated_at).toISOString(),
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

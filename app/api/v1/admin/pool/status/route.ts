import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import {
  getActiveProvider,
  getProviderKeyAvailability,
  getProviderSettings,
  SUPPORTED_LLM_PROVIDERS,
} from "@/lib/v3/services/adminKeyPoolService";
import { query, queryOne } from "@/lib/v3/db";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || auth.role !== "admin") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const settings = await getProviderSettings();
    const activeProvider = await getActiveProvider();
    const activeModel =
      activeProvider === "qwen"
        ? settings.QWEN_MODEL || "qwen-plus"
        : settings.GROQ_MODEL || "openai/gpt-oss-120b";

    const totalActiveRes = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM admin_api_keys WHERE status = 'active' AND provider = $1",
      [activeProvider]
    );
    const availability = await getProviderKeyAvailability(activeProvider, settings);
    const unusedKeysRes = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM admin_api_keys k
       WHERE k.status = 'active' AND k.provider = $1
         AND NOT EXISTS (
           SELECT 1 FROM admin_api_key_assignments a WHERE a.key_id = k.id
         )`,
      [activeProvider]
    );

    const sharingKey = await queryOne<{ id: string }>(
      "SELECT id FROM admin_api_keys WHERE status = 'active' AND allow_sharing = true AND provider = $1 LIMIT 1",
      [activeProvider]
    );

    // Accounts missing keys (a sharing key covers everyone as a fallback)
    const usersMissing = sharingKey
      ? []
      : (
          await query(
            `SELECT u.id, u.username, u.is_superuser as is_admin, u.created_at
             FROM "user" u
             LEFT JOIN admin_api_key_assignments a ON a.user_id = u.id::text AND a.provider = $1
             LEFT JOIN admin_api_keys k ON k.id = a.key_id AND k.provider = $1 AND k.status = 'active'
             WHERE k.id IS NULL AND u.is_active = true
             ORDER BY u.created_at DESC`,
            [activeProvider]
          )
        ).rows;

    return NextResponse.json({
      active_provider: activeProvider,
      active_model: activeModel,
      supported: SUPPORTED_LLM_PROVIDERS.includes(activeProvider),
      available_unassigned_keys: parseInt(unusedKeysRes?.count || "0", 10),
      total_active_keys: parseInt(totalActiveRes?.count || "0", 10),
      has_keys: availability.configured,
      users_missing_keys: usersMissing.map((u: any) => ({
        id: String(u.id),
        username: u.username,
        is_admin: Boolean(u.is_admin),
        created_at: u.created_at ? new Date(u.created_at).toISOString() : null,
      })),
      error: null,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

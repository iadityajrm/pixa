import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { query } from "@/lib/v3/db";
import { getActiveProvider } from "@/lib/v3/services/adminKeyPoolService";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || auth.role !== "admin") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const activeProvider = await getActiveProvider();
    const sharingKey = (
      await query(
        "SELECT id FROM admin_api_keys WHERE status = 'active' AND allow_sharing = true AND provider = $1 LIMIT 1",
        [activeProvider]
      )
    ).rows[0];

    const users = (
      await query(
        `SELECT u.id, u.username, u.is_superuser as is_admin, u.credits,
                u.free_presentation_used, u.has_purchased_credits,
                k.id as assigned_key_id
         FROM "user" u
         LEFT JOIN admin_api_key_assignments a ON a.user_id = u.id::text AND a.provider = $1
         LEFT JOIN admin_api_keys k ON k.id = a.key_id AND k.provider = $1 AND k.status = 'active'
         WHERE u.is_active = true
         ORDER BY u.created_at DESC`,
        [activeProvider]
      )
    ).rows;

    const data = users.map((u: any) => ({
      id: String(u.id),
      username: u.username,
      is_admin: Boolean(u.is_admin),
      has_key: Boolean(sharingKey || u.assigned_key_id),
      assigned_key_id: u.assigned_key_id ? String(u.assigned_key_id) : null,
      credits: u.credits || 0,
      free_presentation_used: Boolean(u.free_presentation_used),
      has_purchased_credits: Boolean(u.has_purchased_credits),
    }));

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

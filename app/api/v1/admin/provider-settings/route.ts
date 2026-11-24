import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import {
  getProviderSettings,
  saveProviderSettings,
} from "@/lib/v3/services/adminKeyPoolService";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const settings = await getProviderSettings();
    if (auth.role !== "admin") {
      // Redact sensitive provider configuration for normal users
      return NextResponse.json({
        LLM: settings.LLM,
        GROQ_MODEL: settings.GROQ_MODEL,
        QWEN_MODEL: settings.QWEN_MODEL,
        IMAGE_PROVIDER: settings.IMAGE_PROVIDER,
        DISABLE_IMAGE_GENERATION: settings.DISABLE_IMAGE_GENERATION,
      });
    }

    return NextResponse.json({
      ...settings,
      PRESENTON_CONNECTED: false,
      PRESENTON_EMAIL: null,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || auth.role !== "admin") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const saved = await saveProviderSettings(body);
    return NextResponse.json(saved);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

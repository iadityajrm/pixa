import { NextRequest, NextResponse } from "next/server";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import {
  getAvailablePoolKey,
  normalizeProvider,
  providerBaseUrl,
  SUPPORTED_LLM_PROVIDERS,
} from "@/lib/v3/services/adminKeyPoolService";

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const auth = await getAuthStatusFromRequest(cookieHeader);
    if (!auth.authenticated || auth.role !== "admin") {
      return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const provider = normalizeProvider(searchParams.get("provider") || "groq");

    if (!SUPPORTED_LLM_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { detail: `Unsupported provider '${provider}'. Use Groq or Qwen.` },
        { status: 400 }
      );
    }

    const key = await getAvailablePoolKey(provider);
    if (!key) {
      return NextResponse.json(
        { detail: `Add an API key for provider '${provider}' before loading models.` },
        { status: 409 }
      );
    }

    const url = `${providerBaseUrl(provider)}/models`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key.trim()}` },
    });

    if (!res.ok) {
      return NextResponse.json(
        { detail: `Provider returned HTTP ${res.status} while listing models.` },
        { status: 502 }
      );
    }

    const payload = await res.json();
    const nonChat = ["whisper", "tts", "orpheus", "guard", "embed", "rerank"];
    const models = (payload.data || [])
      .map((item: any) => item.id)
      .filter((id: string) => id && !nonChat.some((m) => id.toLowerCase().includes(m)))
      .sort();

    return NextResponse.json({ provider, models });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

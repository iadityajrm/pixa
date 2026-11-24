import { NextResponse } from "next/server";
import { authStatusForRequest } from "@/lib/server-auth-role";
import { readRuntimeProviderConfig } from "@/lib/runtime-provider-config";
import { isV3BackendEngine } from "@/proxy";
import {
  getProviderKeyAvailability,
  getProviderSettings,
  normalizeProvider,
} from "@/lib/v3/services/adminKeyPoolService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authStatusForRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  if (isV3BackendEngine()) {
    try {
      const settings = await getProviderSettings();
      const provider = normalizeProvider(settings.LLM || "groq");
      const availability = await getProviderKeyAvailability(provider, settings);
      const hasQwenKey = provider === "qwen" && availability.configured;
      return NextResponse.json({
        configured: availability.configured,
        config: {
          LLM: provider,
          GROQ_MODEL: settings.GROQ_MODEL || "openai/gpt-oss-120b",
          GROQ_API_KEY:
            provider === "groq" && availability.configured ? "__configured__" : "",
          QWEN_MODEL: settings.QWEN_MODEL || "qwen-plus",
          QWEN_API_KEY: hasQwenKey ? "__configured__" : "",
          IMAGE_PROVIDER: settings.IMAGE_PROVIDER || "pexels",
          DISABLE_IMAGE_GENERATION: settings.DISABLE_IMAGE_GENERATION ?? true,
        },
      });
    } catch {
      return NextResponse.json(
        { configured: false, config: {} },
        { status: 200 }
      );
    }
  }

  try {
    return NextResponse.json(readRuntimeProviderConfig());
  } catch {
    return NextResponse.json(
      { configured: false, config: {} },
      { status: 200 }
    );
  }
}

import { NextResponse } from "next/server";
import { getFastApiBaseUrl } from "@/lib/fastapi-internal";
import {
  authStatusForRequest,
  requireAdminApi,
} from "@/lib/server-auth-role";
import { readRuntimeProviderConfig } from "@/lib/runtime-provider-config";
import { DESKTOP_TOKEN_HEADER } from "@/lib/desktop-auth";
import { isV3BackendEngine } from "@/proxy";
import {
  getProviderKeyAvailability,
  getProviderSettings,
  normalizeProvider,
  saveProviderSettings,
} from "@/lib/v3/services/adminKeyPoolService";

async function forwardProviderSettings(
  request: Request,
  method: "GET" | "PUT",
  body?: string
) {
  if (isV3BackendEngine()) {
    if (method === "GET") {
      const settings = await getProviderSettings();
      return NextResponse.json(settings);
    } else {
      const parsed = body ? JSON.parse(body) : {};
      const saved = await saveProviderSettings(parsed);
      return NextResponse.json(saved);
    }
  }

  const cookie = request.headers.get("cookie") || "";
  const response = await fetch(
    `${getFastApiBaseUrl()}/api/v1/admin/provider-settings`,
    {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(request.headers.get(DESKTOP_TOKEN_HEADER) ? { [DESKTOP_TOKEN_HEADER]: request.headers.get(DESKTOP_TOKEN_HEADER)! } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
    }
  );
  const payload = await response.text();
  return new NextResponse(payload || null, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") || "application/json",
    },
  });
}

export async function GET(request: Request) {
  const auth = await authStatusForRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  // Administrators need the real values in the settings forms. Regular users
  // only need the effective provider/model selection; shared secrets must
  // never be sent to their browser.
  if (auth.role !== "admin") {
    if (isV3BackendEngine()) {
      try {
        const settings = await getProviderSettings();
        const provider = normalizeProvider(settings.LLM || "groq");
        const availability = await getProviderKeyAvailability(provider, settings);
        return NextResponse.json({
          LLM: provider,
          configured: availability.configured,
          GROQ_MODEL: settings.GROQ_MODEL || "openai/gpt-oss-120b",
          GROQ_API_KEY:
            provider === "groq" && availability.configured ? "__configured__" : "",
          QWEN_MODEL: settings.QWEN_MODEL || "qwen-plus",
          QWEN_API_KEY:
            provider === "qwen" && availability.configured ? "__configured__" : "",
          IMAGE_PROVIDER: settings.IMAGE_PROVIDER || "pexels",
          DISABLE_IMAGE_GENERATION: settings.DISABLE_IMAGE_GENERATION ?? true,
        });
      } catch {
        return NextResponse.json(
          { error: "Unable to read provider settings", status: 500 },
          { status: 500 }
        );
      }
    }
    try {
      return NextResponse.json(readRuntimeProviderConfig().config);
    } catch {
      return NextResponse.json(
        { error: "Unable to read provider settings", status: 500 },
        { status: 500 }
      );
    }
  }

  try {
    return await forwardProviderSettings(request, "GET");
  } catch {
    return NextResponse.json(
      { error: "Unable to read provider settings", status: 500 },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const denied = await requireAdminApi(request);
  if (denied) return denied;
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  try {
    const body = await request.text();
    if (!body.trim()) {
      return NextResponse.json(
        { error: "Invalid user config JSON body", status: 400 },
        { status: 400 }
      );
    }
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "Invalid user config JSON body", status: 400 },
        { status: 400 }
      );
    }
    return await forwardProviderSettings(request, "PUT", body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid user config JSON body", status: 400 },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Unable to save provider settings", status: 500 },
      { status: 500 }
    );
  }
}

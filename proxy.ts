import { NextRequest, NextResponse } from "next/server";
import { isAuthDisabled } from "@/utils/auth";
import { desktopRequestDenied } from "@/lib/desktop-auth";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";

/**
 * Pixa V3 Engine Selector & Request Proxy
 *
 * Controlled via environment variable:
 * - BACKEND_ENGINE=v3 (Default): Full Vercel serverless backend architecture.
 *   API routes execute natively as Next.js serverless functions using Neon PostgreSQL and cloud storage.
 * - BACKEND_ENGINE=legacy: Rewrites /api/v1/*, /api/v2/*, /static/*, /app_data/* to FastAPI server.
 */

export function isV3BackendEngine(): boolean {
  const engine = (process.env.BACKEND_ENGINE || "v3").trim().toLowerCase();
  return engine === "v3";
}

function getFastApiBaseUrl(): string {
  const internal = process.env.FAST_API_INTERNAL_URL?.trim();
  if (internal) {
    return internal.replace(/\/+$/, "");
  }
  const configured = process.env.NEXT_PUBLIC_FAST_API?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return "http://127.0.0.1:8000";
}

function isFastApiApiPath(pathname: string): boolean {
  return (
    pathname === "/api/v1" ||
    pathname.startsWith("/api/v1/") ||
    pathname === "/api/v2" ||
    pathname.startsWith("/api/v2/")
  );
}

function isFastApiAssetPath(pathname: string): boolean {
  return (
    pathname === "/app_data" ||
    pathname.startsWith("/app_data/") ||
    pathname === "/static" ||
    pathname.startsWith("/static/")
  );
}

function rewriteToFastApi(request: NextRequest): NextResponse {
  const destination = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    `${getFastApiBaseUrl()}/`
  );
  return NextResponse.rewrite(destination);
}

const SESSION_COOKIE_NAME = "presenton_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function isApiAuthExempt(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/about" ||
    pathname === "/contact" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/api/runtime-capabilities" ||
    pathname.startsWith("/api/v1/auth/") ||
    pathname === "/api/telemetry-status" ||
    pathname === "/api/update-svg" ||
    pathname.startsWith("/api/export-presentation-data/")
  );
}

async function getLegacyAuthStatus(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const authStatusUrl = `${getFastApiBaseUrl()}/api/v1/auth/status`;
  try {
    const response = await fetch(authStatusUrl, {
      method: "GET",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
    if (!response.ok) {
      return { configured: true, authenticated: false };
    }
    const payload = await response.json();
    return {
      configured: Boolean(payload.configured),
      authenticated: Boolean(payload.authenticated),
    };
  } catch {
    return { configured: true, authenticated: false };
  }
}

export async function proxy(request: NextRequest) {
  const denied = desktopRequestDenied(request);
  if (denied) return denied;

  const { pathname } = request.nextUrl;
  const useV3 = isV3BackendEngine();

  // Forward the pathname in headers so Server Components / Layouts can inspect it
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-invoke-path", pathname);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-url", request.url);

  // Desktop guard / public pages
  if (!pathname.startsWith("/api/") && !isFastApiAssetPath(pathname) && pathname !== "/pdf-maker") {
    // Check if the user is visiting a dashboard/protected page without authentication
    if (
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/templates" ||
      pathname.startsWith("/templates/") ||
      pathname === "/plans" ||
      pathname.startsWith("/plans/") ||
      pathname === "/subscription" ||
      pathname.startsWith("/subscription/") ||
      pathname === "/settings" ||
      pathname.startsWith("/settings/") ||
      pathname === "/adminconsole" ||
      pathname.startsWith("/adminconsole/") ||
      pathname === "/presentation" ||
      pathname.startsWith("/presentation/") ||
      pathname === "/outline" ||
      pathname.startsWith("/outline/") ||
      pathname === "/custom-template" ||
      pathname.startsWith("/custom-template/")
    ) {
      if (isAuthDisabled()) {
        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
      }
      const authStatus = await getAuthStatusFromRequest(request.headers.get("cookie"));
      if (!authStatus.authenticated) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Handle pdf-maker export session
  if (pathname === "/pdf-maker") {
    const exportSession = request.nextUrl.searchParams.get("exportSession");
    if (exportSession) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.searchParams.delete("exportSession");

      const response = NextResponse.redirect(redirectUrl);
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: exportSession,
        maxAge: SESSION_TTL_SECONDS,
        httpOnly: true,
        secure:
          request.headers.get("x-forwarded-proto")?.toLowerCase() === "https" ||
          request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
      });
      return response;
    }
    return NextResponse.next();
  }

  // If using legacy engine, forward to FastAPI as before
  if (!useV3) {
    if (isFastApiAssetPath(pathname)) {
      return rewriteToFastApi(request);
    }
    if (isAuthDisabled()) {
      return isFastApiApiPath(pathname) ? rewriteToFastApi(request) : NextResponse.next();
    }
    if (request.method === "OPTIONS" || isApiAuthExempt(pathname)) {
      return isFastApiApiPath(pathname) ? rewriteToFastApi(request) : NextResponse.next();
    }
    const authStatus = await getLegacyAuthStatus(request);
    if (authStatus.authenticated) {
      return isFastApiApiPath(pathname) ? rewriteToFastApi(request) : NextResponse.next();
    }
    if (!authStatus.configured) {
      return NextResponse.json(
        { detail: "Login setup is required", setup_required: true },
        { status: 428, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { detail: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  // V3 Serverless Engine handling
  if (isAuthDisabled() || request.method === "OPTIONS" || isApiAuthExempt(pathname)) {
    return NextResponse.next();
  }

  // Session verification using V3 serverless auth
  const authStatus = await getAuthStatusFromRequest(request.headers.get("cookie"));
  if (authStatus.authenticated) {
    return NextResponse.next();
  }
  if (!authStatus.configured) {
    if (!pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.json(
      { detail: "Login setup is required", setup_required: true },
      { status: 428, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.json(
    { detail: "Unauthorized" },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}

export const config = {
  matcher: [
    // Every API route keeps its auth coverage.
    "/api/:path*",
    // Page requests run the proxy, but anything served straight from the
    // static/public layer skips it: running it there adds latency for no
    // benefit and can trigger database-backed auth checks for asset hits.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|mp3|ttf|otf|woff2?|json|txt|xml|map)$).*)",
  ],
};

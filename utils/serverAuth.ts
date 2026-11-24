import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthStatusFromRequest } from "@/lib/v3/auth";
import { isV3BackendEngine } from "@/proxy";

export type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
  user_id: string | null;
  available: boolean;
  role: "admin" | "user" | null;
};

function getServerFastApiBase(): string {
  const internal = process.env.FAST_API_INTERNAL_URL?.trim();
  if (internal) {
    return internal.replace(/\/+$/, "");
  }
  const fromEnv = process.env.NEXT_PUBLIC_FAST_API?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }
  return "http://127.0.0.1:8000";
}

export async function getServerAuthStatus(): Promise<AuthStatus> {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  if (isV3BackendEngine()) {
    try {
      const status = await getAuthStatusFromRequest(cookie);
      return {
        configured: status.configured,
        authenticated: status.authenticated,
        username: status.username,
        user_id: status.user_id,
        available: true,
        role: status.role,
      };
    } catch {
      return {
        configured: true,
        authenticated: false,
        username: null,
        user_id: null,
        available: false,
        role: null,
      };
    }
  }

  try {
    const response = await fetch(`${getServerFastApiBase()}/api/v1/auth/status`, {
      method: "GET",
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        configured: true,
        authenticated: false,
        username: null,
        user_id: null,
        available: false,
        role: null,
      };
    }
    const data = (await response.json()) as Partial<AuthStatus>;
    return {
      configured: Boolean(data.configured),
      authenticated: Boolean(data.authenticated),
      username: data.username ?? null,
      user_id: data.user_id ?? null,
      available: true,
      role: data.role === "admin" ? "admin" : data.role === "user" ? "user" : null,
    };
  } catch {
    return {
      configured: true,
      authenticated: false,
      username: null,
      user_id: null,
      available: false,
      role: null,
    };
  }
}

export async function requireAppSession() {
  const s = await getServerAuthStatus();
  if (!s.authenticated) {
    redirect("/login");
  }
}

export async function requireAdminSession() {
  const status = await getServerAuthStatus();
  if (!status.authenticated) {
    redirect("/login");
  }
  if (status.role !== "admin") {
    redirect("/dashboard");
  }
}

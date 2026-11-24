import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionJwt } from "../auth";

/**
 * Resolve the signed-in account for the current server request so provider
 * calls can use that account's assigned pool key. Returns null outside a
 * request scope (for example, background scripts).
 */
export async function getRequestUserId(): Promise<string | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionJwt(token)?.sub ?? null;
  } catch {
    return null;
  }
}

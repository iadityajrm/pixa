import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { queryOne } from "../db";
import { ensureSchema } from "../db/schema";

export const SESSION_COOKIE_NAME = "presenton_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

let instanceHasUsers = false;

export function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "decraft_v3_default_secret_key_change_in_production_1234567890"
  );
}

export function isAuthDisabled(): boolean {
  const val = (
    process.env.DISABLE_AUTH ||
    process.env.NEXT_PUBLIC_DISABLE_AUTH ||
    ""
  ).toLowerCase();
  return val === "true" || val === "1";
}

export type V3User = {
  id: string;
  username: string;
  admin_slot: string | null;
  hashed_password: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  created_at: string | null;
  auth_version: number;
  credits: number;
  free_presentation_used: boolean;
  has_purchased_credits: boolean;
};

export type V3AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
  user_id: string | null;
  role: "admin" | "user" | null;
  credits: number;
  free_presentation_used: boolean;
  has_purchased_credits: boolean;
};

export async function hashPassword(plain: string): Promise<string> {
  return await bcrypt.hash(plain, 10);
}

export function verifyLegacyPassword(plain: string, encodedHash: string): boolean {
  try {
    const parts = encodedHash.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
    const iterations = parseInt(parts[1], 10);
    const salt = Buffer.from(parts[2], "base64");
    const expectedDigest = Buffer.from(parts[3], "base64");
    const actualDigest = crypto.pbkdf2Sync(
      plain,
      salt,
      iterations,
      expectedDigest.length,
      "sha256"
    );
    return crypto.timingSafeEqual(actualDigest, expectedDigest);
  } catch {
    return false;
  }
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  if (hashed.startsWith("pbkdf2_sha256$")) {
    return verifyLegacyPassword(plain, hashed);
  }
  return await bcrypt.compare(plain, hashed);
}

export function signSessionJwt(user: V3User): string {
  const payload = {
    sub: user.id,
    av: user.auth_version,
    aud: ["fastapi-users:auth"],
  };
  return jwt.sign(payload, getAuthSecret(), {
    expiresIn: SESSION_TTL_SECONDS,
    algorithm: "HS256",
  });
}

export function verifySessionJwt(token: string): { sub: string; av: number } | null {
  try {
    const decoded = jwt.verify(token, getAuthSecret()) as any;
    if (decoded && decoded.sub && typeof decoded.av === "number") {
      return { sub: decoded.sub, av: decoded.av };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getUserFromSessionCookie(cookieValue?: string | null): Promise<V3User | null> {
  if (!cookieValue) return null;
  const decoded = verifySessionJwt(cookieValue);
  if (!decoded) return null;

  await ensureSchema();
  const user = await queryOne<V3User>(
    'SELECT * FROM "user" WHERE id = $1 AND is_active = true',
    [decoded.sub]
  );

  if (!user || user.auth_version !== decoded.av) {
    return null;
  }
  return user;
}

export async function getAuthStatusFromRequest(
  cookieHeader?: string | null
): Promise<V3AuthStatus> {
  if (isAuthDisabled()) {
    return {
      configured: true,
      authenticated: true,
      username: "electron",
      user_id: null,
      role: "admin",
      credits: 9999,
      free_presentation_used: false,
      has_purchased_credits: true,
    };
  }

  await ensureSchema();
  // "configured" only flips from false to true (a user exists), so cache the
  // positive result to avoid a COUNT(*) on every auth check in this instance.
  let configured = instanceHasUsers;
  if (!configured) {
    const countRes = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM "user"'
    );
    configured = parseInt(countRes?.count || "0", 10) > 0;
    if (configured) instanceHasUsers = true;
  }

  let sessionToken: string | null = null;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)presenton_session=([^;]+)/);
    if (match?.[1]) {
      sessionToken = decodeURIComponent(match[1]);
    }
  }

  const user = await getUserFromSessionCookie(sessionToken);

  return {
    configured,
    authenticated: user !== null,
    username: user ? user.username : null,
    user_id: user ? user.id : null,
    role: user ? (user.is_superuser ? "admin" : "user") : null,
    credits: user ? user.credits : 0,
    free_presentation_used: user ? user.free_presentation_used : false,
    has_purchased_credits: user ? user.has_purchased_credits : false,
  };
}

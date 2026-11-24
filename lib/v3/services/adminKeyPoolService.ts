import { query, queryOne } from "../db";
import { ensureSchema } from "../db/schema";

export const SUPPORTED_LLM_PROVIDERS = ["groq", "qwen"];

export function normalizeProvider(provider: string): string {
  const p = provider.trim().toLowerCase();
  if (p === "groq") return "groq";
  if (p === "qwen" || p === "dashscope") return "qwen";
  return p;
}

export function providerBaseUrl(provider: string): string {
  const p = normalizeProvider(provider);
  if (p === "groq") return "https://api.groq.com/openai/v1";
  if (p === "qwen") return "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
  return "https://api.groq.com/openai/v1";
}

export async function getProviderSettings(): Promise<Record<string, any>> {
  await ensureSchema();
  const row = await queryOne<{ config: any }>(
    "SELECT config FROM provider_settings WHERE id = 1"
  );
  if (row && row.config) {
    return typeof row.config === "string" ? JSON.parse(row.config) : row.config;
  }
  return {
    LLM: "groq",
    GROQ_MODEL: "openai/gpt-oss-120b",
    QWEN_MODEL: "qwen-plus",
    IMAGE_PROVIDER: "pexels",
    DISABLE_IMAGE_GENERATION: true,
  };
}

export async function saveProviderSettings(
  config: Record<string, any>
): Promise<Record<string, any>> {
  await ensureSchema();
  const current = await getProviderSettings();
  const merged = { ...current, ...config };
  await query(
    `INSERT INTO provider_settings (id, config, updated_at)
     VALUES (1, $1, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET config = $1, updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(merged)]
  );
  return merged;
}

export async function getActiveProvider(): Promise<string> {
  const settings = await getProviderSettings();
  return normalizeProvider(settings.LLM || "groq");
}

function providerEnvironmentKey(provider: string): string | null {
  if (provider === "groq") {
    return process.env.GROQ_API_KEY || process.env.CUSTOM_LLM_API_KEY || null;
  }
  if (provider === "qwen") {
    return process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || null;
  }
  return null;
}

/**
 * Check the *effective* text provider configuration: an active key in the admin
 * pool for the selected provider, the key saved through the admin dashboard, or
 * a server environment key.
 */
export async function getProviderKeyAvailability(
  provider?: string,
  settings?: Record<string, any>
): Promise<{
  provider: string;
  poolKeys: number;
  hasEnvKey: boolean;
  configured: boolean;
}> {
  await ensureSchema();
  const effectiveProvider = provider
    ? normalizeProvider(provider)
    : await getActiveProvider();
  const settingsSnapshot = settings ?? (await getProviderSettings());

  const countRes = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM admin_api_keys WHERE provider = $1 AND status = 'active'",
    [effectiveProvider]
  );
  const poolKeys = parseInt(countRes?.count || "0", 10);

  const savedKey =
    effectiveProvider === "qwen"
      ? settingsSnapshot.QWEN_API_KEY
      : settingsSnapshot.GROQ_API_KEY;
  const hasEnvKey = Boolean(savedKey || providerEnvironmentKey(effectiveProvider));

  return {
    provider: effectiveProvider,
    poolKeys,
    hasEnvKey,
    configured: poolKeys > 0 || hasEnvKey,
  };
}

/**
 * Deterministic round-robin distribution. With more users than keys the extra
 * users spread across the first keys, so the difference between the busiest and
 * quietest key is never greater than one.
 */
export function planBalancedAssignments(
  userIds: string[],
  keyIds: string[]
): Array<{ userId: string; keyId: string }> {
  if (keyIds.length === 0) return [];
  return userIds.map((userId, index) => ({
    userId,
    keyId: keyIds[index % keyIds.length],
  }));
}

export async function getAvailablePoolKey(
  provider?: string,
  userId?: string | null
): Promise<string | null> {
  await ensureSchema();
  const effectiveProvider = provider ? normalizeProvider(provider) : await getActiveProvider();

  if (userId) {
    const assigned = await queryOne<{ key_value: string }>(
      `SELECT k.key_value
       FROM admin_api_key_assignments a
       JOIN admin_api_keys k ON k.id = a.key_id
       WHERE a.user_id = $1 AND a.provider = $2
         AND k.provider = $2 AND k.status = 'active'
       LIMIT 1`,
      [userId, effectiveProvider]
    );
    if (assigned?.key_value) {
      return assigned.key_value;
    }

    // A session can outlive a pool change; assign this account on demand so the
    // load keeps spreading instead of falling back to one shared key.
    const lazyAssigned = await assignKeyToUser(userId, effectiveProvider);
    if (lazyAssigned?.key_value) {
      return lazyAssigned.key_value;
    }
  }

  // 1. Try to find an active key in admin_api_keys
  const keyRow = await queryOne<{ key_value: string }>(
    `SELECT key_value FROM admin_api_keys
     WHERE provider = $1 AND status = 'active'
     ORDER BY allow_sharing DESC, created_at ASC, id ASC
     LIMIT 1`,
    [effectiveProvider]
  );
  if (keyRow && keyRow.key_value) {
    return keyRow.key_value;
  }

  // 2. Fallback to server environment keys
  return providerEnvironmentKey(effectiveProvider) || (
    effectiveProvider !== "groq" && effectiveProvider !== "qwen"
      ? process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || null
      : null
  );
}

export async function assignKeyToUser(
  userId: string,
  provider?: string
) {
  await ensureSchema();
  const p = provider ? normalizeProvider(provider) : await getActiveProvider();

  // Keep an existing assignment when it still points at an active key.
  const existing = await queryOne<any>(
    `SELECT k.* FROM admin_api_key_assignments a
     JOIN admin_api_keys k ON k.id = a.key_id
     WHERE a.user_id = $1 AND a.provider = $2
       AND k.provider = $2 AND k.status = 'active'
     LIMIT 1`,
    [userId, p]
  );
  if (existing) return { ...existing, assigned_user_id: userId };

  // Pick the least-loaded active key so new accounts balance automatically.
  const available = await queryOne<any>(
    `SELECT k.*
     FROM admin_api_keys k
     LEFT JOIN admin_api_key_assignments a ON a.key_id = k.id AND a.provider = k.provider
     WHERE k.provider = $1 AND k.status = 'active'
     GROUP BY k.id
     ORDER BY COUNT(a.user_id) ASC, k.created_at ASC, k.id ASC
     LIMIT 1`,
    [p]
  );

  if (!available) {
    return null;
  }

  await query(
    `INSERT INTO admin_api_key_assignments (user_id, key_id, provider, assigned_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       key_id = EXCLUDED.key_id,
       provider = EXCLUDED.provider,
       assigned_at = CURRENT_TIMESTAMP`,
    [userId, available.id, p]
  );

  return { ...available, assigned_user_id: userId };
}

export type BalanceResult = {
  provider: string;
  total_keys: number;
  total_users: number;
  assigned: number;
  distribution: Array<{ key_id: string; users: number }>;
};

/**
 * Redistribute every active account across the active keys of a provider as
 * evenly as possible. Safe to call repeatedly; also prunes assignments that
 * point at deleted accounts or inactive keys.
 */
export async function balanceKeyAssignments(
  provider?: string
): Promise<BalanceResult> {
  await ensureSchema();
  const p = provider ? normalizeProvider(provider) : await getActiveProvider();

  const keyRows = (
    await query<{ id: string }>(
      `SELECT id FROM admin_api_keys
       WHERE provider = $1 AND status = 'active'
       ORDER BY created_at ASC, id ASC`,
      [p]
    )
  ).rows;
  const userRows = (
    await query<{ id: string }>(
      `SELECT id FROM "user" WHERE is_active = true ORDER BY created_at ASC, id ASC`
    )
  ).rows;

  const keyIds = keyRows.map((row) => String(row.id));
  const userIds = userRows.map((row) => String(row.id));

  // Drop assignments whose key is no longer usable or whose account is gone.
  await query(
    `DELETE FROM admin_api_key_assignments a
     WHERE NOT EXISTS (
       SELECT 1 FROM "user" u WHERE u.id::text = a.user_id AND u.is_active = true
     )
     OR (
       a.provider = $1
       AND NOT EXISTS (
         SELECT 1 FROM admin_api_keys k
         WHERE k.id = a.key_id AND k.status = 'active' AND k.provider = $1
       )
     )`,
    [p]
  );

  // Clear legacy single-account pointers left behind by deleted users.
  await query(
    `UPDATE admin_api_keys
     SET assigned_user_id = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE assigned_user_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM "user" u WHERE u.id::text = admin_api_keys.assigned_user_id
       )`
  );

  const plan = planBalancedAssignments(userIds, keyIds);
  if (plan.length > 0) {
    await query(
      `INSERT INTO admin_api_key_assignments (user_id, key_id, provider, assigned_at)
       SELECT user_id, key_id, provider, CURRENT_TIMESTAMP
       FROM UNNEST($1::text[], $2::text[], $3::text[]) AS t(user_id, key_id, provider)
       ON CONFLICT (user_id) DO UPDATE SET
         key_id = EXCLUDED.key_id,
         provider = EXCLUDED.provider,
         assigned_at = CURRENT_TIMESTAMP`,
      [
        plan.map((item) => item.userId),
        plan.map((item) => item.keyId),
        plan.map(() => p),
      ]
    );
  }

  const distribution = keyIds.map((keyId) => ({
    key_id: keyId,
    users: plan.filter((item) => item.keyId === keyId).length,
  }));

  return {
    provider: p,
    total_keys: keyIds.length,
    total_users: userIds.length,
    assigned: plan.length,
    distribution,
  };
}

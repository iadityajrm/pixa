import { Pool, neon, neonConfig } from "@neondatabase/serverless";

// Neon serverless database client with pooled connection support
// Compatible with Vercel edge/serverless runtimes

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  // Helpful development warning if DATABASE_URL is not yet configured
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[Pixa V3 DB] WARNING: DATABASE_URL is not set. Database queries will fail until configured."
    );
  }
}

// Global pool instance to reuse connections across serverless function invocations
let poolInstance: Pool | null = null;

export function getDbPool(): Pool {
  if (!poolInstance) {
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL environment variable is required for Pixa V3 Neon PostgreSQL backend."
      );
    }
    poolInstance = new Pool({ connectionString: databaseUrl });
  }
  return poolInstance;
}

export function getDbSql() {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required for Pixa V3 Neon PostgreSQL backend."
    );
  }
  return neon(databaseUrl);
}

/**
 * Execute a query with parameters using the Neon pool
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getDbPool();
  const res = await pool.query(text, params);
  if (Array.isArray(res)) {
    // Multi-statement query result
    const last = res[res.length - 1];
    return {
      rows: (last?.rows || []) as T[],
      rowCount: last?.rowCount ?? last?.rows?.length ?? 0,
    };
  }
  return {
    rows: (res.rows || []) as T[],
    rowCount: res.rowCount ?? res.rows?.length ?? 0,
  };
}

/**
 * Execute a query returning a single row or null
 */
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const { rows } = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute a transaction with automatic rollback on error
 */
export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

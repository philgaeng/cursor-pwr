/**
 * Postgres pool for Vercel serverless (Supabase).
 * Enable by setting POSTGRES_URL or POSTGRES_PRISMA_URL (Vercel Supabase integration).
 * @module
 */

let pool = null;

const connectionString = () =>
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  "";

const usePersistence = () => Boolean(connectionString().trim());

/** Supabase (and many hosted PG URLs) require TLS; Vercel ↔ direct DB often needs explicit ssl. */
const poolOptionsFromUrl = (cs) => {
  const lower = cs.toLowerCase();
  const hostNeedsSsl =
    lower.includes("supabase.co") ||
    lower.includes("pooler.supabase") ||
    lower.includes("amazonaws.com") ||
    lower.includes("neon.tech") ||
    lower.includes("sslmode=require") ||
    lower.includes("ssl=true");
  if (!hostNeedsSsl) {
    return {};
  }
  return {
    ssl: {
      rejectUnauthorized: false,
    },
  };
};

const getPool = () => {
  if (!usePersistence()) return null;
  if (pool) return pool;
  const { Pool } = require("pg");
  const cs = connectionString();
  pool = new Pool({
    connectionString: cs,
    max: 1,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 20000,
    ...poolOptionsFromUrl(cs),
  });
  return pool;
};

/**
 * @param {string} text
 * @param {unknown[]} [params]
 */
const query = async (text, params = []) => {
  const p = getPool();
  if (!p) throw new Error("Database not configured (missing POSTGRES_URL).");
  return p.query(text, params);
};

/** Lightweight connectivity check for /api/health */
const ping = async () => {
  if (!usePersistence()) return { ok: true, skipped: true };
  try {
    await query("SELECT 1 AS ok");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
};

module.exports = {
  usePersistence,
  getPool,
  query,
  ping,
};

// ============================================================
// Supabase data layer (server-side, service_role).
// The API server is the ONLY writer/reader: it authenticates with the
// service_role key (bypasses RLS) and keeps the exact JSON contract the
// React frontend expects. No VITE_* key is ever needed in the browser.
//
// Env (server only — never expose in the browser):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let _client: SupabaseClient | null = null;

export function isDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

export function getDb(): SupabaseClient {
  if (!isDbConfigured()) {
    throw Object.assign(
      new Error(
        "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "in .env (local) or Render env vars (production), then retry.",
      ),
      { code: "DB_NOT_CONFIGURED" },
    );
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

// A down/unreachable database must NEVER crash the server — callers
// return 503 JSON so the frontend shows a friendly message.
export function isDbConnectionError(err: any): boolean {
  if (!isDbConfigured() || err?.code === "DB_NOT_CONFIGURED") return true;
  const msg = String(err?.message || "");
  return (
    err?.code === "ENOTFOUND" ||
    /fetch failed|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|network|getaddrinfo/i.test(msg)
  );
}

export function dbErrorMessage(err: any): string {
  if (!isDbConfigured() || err?.code === "DB_NOT_CONFIGURED") {
    return (
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "in .env (local) or Render env vars (production), then retry."
    );
  }
  if (isDbConnectionError(err)) {
    return (
      `Cannot reach Supabase at ${SUPABASE_URL}. ` +
      "Verify SUPABASE_URL, the project is not paused, and network access, then retry."
    );
  }
  return err?.message || "Database error.";
}

export function sendDbError(res: { status: (c: number) => { json: (b: any) => void } }, err: any) {
  const status = isDbConnectionError(err) ? 503 : 500;
  res.status(status).json({ error: dbErrorMessage(err) });
}

// PostgREST may return NUMERIC (money) columns as strings; the old MySQL
// layer coerced DECIMAL → Number, and the frontend relies on real numbers
// (cart math). Coercion is a no-op when values already arrive as numbers.
const NUMERIC_COLUMNS: Record<string, string[]> = {
  products: ["price"],
  sales: ["amount_before_discount", "discount_applied", "final_amount"],
};

export function coerceNumerics<T>(table: string, rows: T): T {
  const cols = NUMERIC_COLUMNS[table];
  if (!cols || rows === null || rows === undefined) return rows;
  const fix = (r: any) => {
    const c = { ...r };
    for (const k of cols) {
      if (c[k] !== null && c[k] !== undefined) {
        const n = Number(c[k]);
        if (Number.isFinite(n)) c[k] = n;
      }
    }
    return c;
  };
  return (Array.isArray(rows) ? rows.map(fix) : fix(rows)) as T;
}

// Escape LIKE wildcards so ilike() matches literally (e.g. emails with "_").
export function escapeLike(s: string): string {
  return s.replace(/([%_\\])/g, "\\$&");
}

// Unique-ish id helpers (same scheme as before, plus a random tail so two
// inserts in the same millisecond cannot collide on the TEXT primary key).
export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

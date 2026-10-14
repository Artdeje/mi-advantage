// ============================================================
// One-off migration: copy every row from local MySQL (XAMPP)
// into Supabase (Postgres). Idempotent — safe to re-run
// (upserts on primary key `id`).
//
// 1. Run supabase-schema.sql once in the Supabase SQL Editor.
// 2. Start MySQL (XAMPP) so the source data is reachable.
// 3. Set env and run:
//      SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed-supabase
//
// Tables migrate in FK order: admins → shops → customers → products →
// sales → audit_logs → customization → verification_codes.
// ============================================================
import "dotenv/config";
import mysql from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";

const TABLES = [
  "admins",
  "shops",
  "customers",
  "products",
  "sales",
  "audit_logs",
  "customization",
  "verification_codes",
];

// MySQL driver types → Postgres-friendly JSON values.
function normalize(value: any): any {
  if (value === undefined) return null;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (value instanceof Date) return value.toISOString();
  // mysql2 returns TINYINT(1) booleans as 0/1 — Supabase wants true/false.
  return value;
}

function normalizeRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "valid_until" && v instanceof Date) {
      // DATE column: keep the calendar day, drop the time part.
      out[k] = v.toISOString().slice(0, 10);
    } else if ((k === "used" || k === "email_verified") && typeof v === "number") {
      out[k] = v === 1;
    } else {
      out[k] = normalize(v);
    }
  }
  return out;
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL || "";
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Mi Advantage — MySQL → Supabase migration");
  console.log("==========================================");
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "mi_advantage",
  });

  try {
    for (const table of TABLES) {
      let rows: any[];
      try {
        const [data] = await conn.query(`SELECT * FROM \`${table}\``);
        rows = (data as any[]).map(normalizeRow);
      } catch (e: any) {
        console.warn(`- ${table}: skipped (MySQL: ${e?.code || e?.message})`);
        continue;
      }
      if (rows.length === 0) {
        console.log(`- ${table}: 0 rows in MySQL, nothing to copy.`);
        continue;
      }
      // Upsert in batches (PostgREST/Postgres friendly size).
      let done = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200);
        const { error } = await supabase.from(table).upsert(batch, { onConflict: "id" });
        if (error) {
          console.error(`- ${table}: batch ${i / 200 + 1} FAILED: ${error.message}`);
          break;
        }
        done += batch.length;
      }
      console.log(`- ${table}: ${done}/${rows.length} rows upserted.`);
    }
    console.log("");
    console.log("Migration complete. Verify: GET /api/db/test on the deployed app.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Fatal migration error:", err?.message || err);
  process.exit(1);
});

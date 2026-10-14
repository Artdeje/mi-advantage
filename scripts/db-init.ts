import "dotenv/config";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

const DB_HOST = process.env.MYSQL_HOST || "localhost";
const DB_PORT = Number(process.env.MYSQL_PORT || 3306);
const DB_USER = process.env.MYSQL_USER || "root";
const DB_PASS = process.env.MYSQL_PASSWORD || "";
const DB_NAME = process.env.MYSQL_DATABASE || "mi_advantage";

async function main() {
  console.log("Mi Advantage - Database Initialization (MySQL)");
  console.log("==============================================");
  console.log(`MySQL: ${DB_HOST}:${DB_PORT}/${DB_NAME} as ${DB_USER}`);
  console.log("");

  const schemaPath = path.join(process.cwd(), "mysql-schema.sql");
  if (!fs.existsSync(schemaPath)) {
    console.error(`ERROR: schema file not found: ${schemaPath}`);
    process.exit(1);
  }

  // Connect without database first so CREATE DATABASE works on fresh XAMPP.
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    multipleStatements: true,
  });

  try {
    const raw = fs.readFileSync(schemaPath, "utf-8");
    // Strip full-line and inline SQL comments starting with --
    const cleaned = raw
      .split("\n")
      .map((line) => {
        const idx = line.indexOf("--");
        return idx >= 0 ? line.substring(0, idx) : line;
      })
      .join("\n");
    const statements = cleaned
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let executed = 0;
    let skipped = 0;
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
        executed++;
      } catch (e: any) {
        // INSERT IGNORE / IF NOT EXISTS already handle duplicates; any other
        // duplicate error is safe to skip during idempotent seeding.
        const msg = e?.message || "";
        if (msg.includes("Duplicate") || msg.includes("already exists")) {
          skipped++;
        } else {
          console.warn("Seed warning:", msg.substring(0, 200));
          skipped++;
        }
      }
    }

    // Verify tables
    await conn.query(`USE \`${DB_NAME}\``);
    const [tables] = await conn.query(
      "SELECT TABLE_NAME AS t FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?",
      [DB_NAME]
    );
    const names = (tables as any[]).map((r) => r.t).sort();

    console.log("");
    console.log(`Executed: ${executed} statements, skipped: ${skipped}.`);
    console.log(`Tables in ${DB_NAME}: ${names.join(", ") || "(none)"}`);
    console.log("");
    console.log("Database initialization complete!");
    console.log("");
    console.log("Default credentials (change in production!):");
    console.log("  Admin: artdeje@mail.com / admin123");
    console.log("  Shop:  kigalifashion@shop.com / shop123");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err?.message || err);
  process.exit(1);
});

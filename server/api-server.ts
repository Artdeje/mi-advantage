import "dotenv/config";
import express from "express";
import mysql from "mysql2/promise";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "5mb" }));

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});

// ==========================================
// DATABASE
// ==========================================

const DB_HOST = process.env.MYSQL_HOST || "localhost";
const DB_PORT = Number(process.env.MYSQL_PORT || 3306);
const DB_USER = process.env.MYSQL_USER || "root";
const DB_PASS = process.env.MYSQL_PASSWORD || "";
const DB_NAME = process.env.MYSQL_DATABASE || "mi_advantage";

const pool = mysql.createPool({
  host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASS,
  database: DB_NAME, waitForConnections: true, connectionLimit: 10, charset: "utf8mb4",
  typeCast(field, next) {
    if (field.type === "TINY" && field.length === 1) return field.string() === "1";
    if (field.type === "DECIMAL" || field.type === "NEWDECIMAL") {
      const v = field.string(); return v ? Number(v) : 0;
    }
    return next();
  },
});

const ALLOWED_TABLES = new Set([
  "admins", "shops", "customers", "sales", "products",
  "audit_logs", "customization", "verification_codes",
]);
function validateTable(t: string) { return ALLOWED_TABLES.has(t); }

// Allow only safe SQL identifiers (column names) to prevent injection via
// order/filter/data keys. Table names are already whitelisted above.
function isSafeIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

// Map low-level MySQL connection errors to a friendly message + status.
// A down database must NEVER crash the server — callers return 503 JSON.
function isDbConnectionError(err: any): boolean {
  const code = err?.code || err?.errno;
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "EHOSTUNREACH" ||
    code === "PROTOCOL_CONNECTION_LOST"
  );
}

function dbErrorMessage(err: any): string {
  if (isDbConnectionError(err)) {
    return (
      `Cannot reach MySQL at ${DB_HOST}:${DB_PORT}. ` +
      "Start MySQL (XAMPP Control Panel → MySQL → Start), " +
      "verify MYSQL_HOST/MYSQL_PORT in .env, then retry."
    );
  }
  if (err?.code === "ER_ACCESS_DENIED_ERROR") {
    return "MySQL access denied. Check MYSQL_USER / MYSQL_PASSWORD in .env.";
  }
  if (err?.code === "ER_BAD_DB_ERROR") {
    return `MySQL database '${DB_NAME}' not found. Run: npm run db:init`;
  }
  return err?.message || "Database error.";
}

function sendDbError(res: express.Response, err: any) {
  const status = isDbConnectionError(err) ? 503 : 500;
  res.status(status).json({ error: dbErrorMessage(err) });
}

// ==========================================
// SESSION STORE (in-memory token map)
// ==========================================

interface Session {
  token: string;
  userId: string;
  role: "admin" | "shop";
  email: string;
  name: string;
  adminRole?: string;
  shopId?: string;
  createdAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function createSession(user: Omit<Session, "token" | "createdAt">): Session {
  const token = crypto.randomBytes(32).toString("hex");
  const session: Session = { ...user, token, createdAt: Date.now() };
  sessions.set(token, session);
  return session;
}

function getSession(token: string): Session | null {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL) { sessions.delete(token); return null; }
  return s;
}

function destroySession(token: string) { sessions.delete(token); }

// Periodically purge expired sessions so the in-memory map cannot grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL) sessions.delete(token);
  }
}, 60 * 60 * 1000);

// ==========================================
// AUTH MIDDLEWARE
// ==========================================

// Paths that do NOT require authentication
const PUBLIC_PATHS = new Set([
  "/api/db/auth/login",
  "/api/db/auth/logout",
  "/api/db/auth/register-admin",
  "/api/db/auth/verify-email",
  "/api/db/auth/request-reset",
  "/api/db/auth/reset-password",
  "/api/db/test",
  "/api/db/seed",
]);

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Allow public paths
  if (PUBLIC_PATHS.has(req.path)) { next(); return; }
  // Allow all auth-related routes (prefix match)
  if (req.path.startsWith("/api/db/auth/")) { next(); return; }
  // Also allow check-column (used by frontend for migration compat)
  if (req.path.startsWith("/api/db/check-column")) { next(); return; }
  // Allow unauthenticated GET to customization (public branding)
  if (req.method === "GET" && req.path === "/api/db/customization") { next(); return; }
  // Allow unauthenticated GET to shops (public partner list for CustomerPortal)
  if (req.method === "GET" && req.path === "/api/db/shops" && !req.query.single) { next(); return; }
  // Allow unauthenticated customer QR lookup
  if (req.method === "GET" && req.path === "/api/db/customers" && req.query.qr_code_ilike) { next(); return; }
  // Allow unauthenticated POST to customers (for CustomerPortal QR scan logging)
  if (req.method === "POST" && req.path === "/api/db/customers") { next(); return; }
  // Allow unauthenticated POST to sales (for CustomerPortal transaction creation)
  if (req.method === "POST" && req.path === "/api/db/sales") { next(); return; }
  // Allow unauthenticated GET to audit_logs (for CustomerPortal scan logging)
  if (req.method === "POST" && req.path === "/api/db/audit_logs") { next(); return; }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required. Please log in." });
    return;
  }
  const token = authHeader.substring(7);
  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: "Invalid or expired session. Please log in again." });
    return;
  }
  req.session = session;
  next();
}

app.use(authMiddleware);

// ==========================================
// AUTH ROUTES
// ==========================================

app.post("/api/db/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) { res.status(400).json({ error: "Email and password required." }); return; }
    const lowerEmail = String(email).toLowerCase().trim();

    // Check admins
    const [adminRows] = await pool.query(
      "SELECT * FROM admins WHERE LOWER(email) = ? LIMIT 1", [lowerEmail]
    );
    const admin = (adminRows as any[])[0];
    if (admin) {
      if (password !== admin.password) { res.status(401).json({ error: "Invalid password." }); return; }
      if (admin.status === "suspended") { res.status(403).json({ error: "Account suspended." }); return; }
      if (admin.email_verified === false) {
        res.status(403).json({ error: "Email not verified.", code: "EMAIL_NOT_VERIFIED", userType: "admin" });
        return;
      }
      const session = createSession({
        userId: admin.id, role: "admin", email: admin.email,
        name: admin.name, adminRole: admin.role,
      });
      // Log login (best effort — never block login on audit failure)
      try {
        await pool.query(
          "INSERT INTO audit_logs (id, action, user_role, user_email, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
          [`log-${Date.now()}`, "Admin Login", "Admin", admin.email, `Admin ${admin.name} logged in.`]
        );
      } catch (logErr) { console.warn("Login audit log failed:", (logErr as any)?.message); }
      res.json({
        token: session.token,
        user: { id: admin.id, name: admin.name, email: admin.email, role: "admin", admin_role: admin.role },
      });
      return;
    }

    // Check shops
    const [shopRows] = await pool.query(
      "SELECT * FROM shops WHERE LOWER(email) = ? LIMIT 1", [lowerEmail]
    );
    const shop = (shopRows as any[])[0];
    if (shop) {
      if (!shop.password || password !== shop.password) { res.status(401).json({ error: "Invalid password." }); return; }
      if (shop.email_verified === false) {
        res.status(403).json({ error: "Email not verified.", code: "EMAIL_NOT_VERIFIED", userType: "shop" });
        return;
      }
      if (shop.status === "pending") {
        res.status(403).json({ error: "Shop application pending admin approval.", code: "ACCOUNT_PENDING" });
        return;
      }
      if (shop.status === "rejected") {
        res.status(403).json({ error: "Shop application was not approved.", code: "ACCOUNT_REJECTED" });
        return;
      }
      const session = createSession({
        userId: shop.id, role: "shop", email: shop.email,
        name: shop.shop_name, shopId: shop.id,
      });
      try {
        await pool.query(
          "INSERT INTO audit_logs (id, action, user_role, user_email, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
          [`log-${Date.now()}`, "Shop Login", "Shop", shop.email, `Shop ${shop.shop_name} logged in.`]
        );
      } catch (logErr) { console.warn("Login audit log failed:", (logErr as any)?.message); }
      res.json({
        token: session.token,
        user: { id: shop.id, name: shop.shop_name, email: shop.email, role: "shop", shop_id: shop.id },
      });
      return;
    }

    res.status(401).json({ error: "No account found with this email." });
  } catch (err: any) {
    sendDbError(res, err);
  }
});

app.post("/api/db/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    destroySession(authHeader.substring(7));
  }
  res.json({ ok: true });
});

// --- Public: Admin registration ---
app.post("/api/db/auth/register-admin", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required." }); return;
    }
    const lowerEmail = String(email).toLowerCase().trim();
    const [existing] = await pool.query("SELECT id FROM admins WHERE LOWER(email) = ?", [lowerEmail]);
    if ((existing as any[]).length > 0) {
      res.status(409).json({ error: "An administrator with this email already exists!" }); return;
    }
    const id = "admin-" + Date.now();
    await pool.query(
      "INSERT INTO admins (id, name, email, password, role, status, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
      [id, name, lowerEmail, password, "admin", "active", false]
    );
    // Generate and store verification code
    const code = "MA-" + Math.floor(100000 + Math.random() * 900000);
    const vcId = "vcode-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await pool.query(
      "INSERT INTO verification_codes (id, email, code, purpose, user_type, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
      [vcId, lowerEmail, code, "signup", "admin", expiresAt, false]
    );
    // Send email (best effort) via the email server
    try {
      const EMAIL_PORT = process.env.EMAIL_SERVER_PORT || 3001;
      await fetch(`http://localhost:${EMAIL_PORT}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: lowerEmail, subject: "Verify your Mi Advantage account", html: `<p>Your verification code is: <strong>${code}</strong></p><p>Use this code to verify your email address and activate your account.</p><p>This code expires in 15 minutes.</p>` }),
      });
    } catch { /* email may not be configured */ }
    res.json({ ok: true, message: "Account created. Check your email for the verification code." });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// --- Public: Verify email code ---
app.post("/api/db/auth/verify-email", async (req, res) => {
  try {
    const { email, code, purpose } = req.body || {};
    if (!email || !code) {
      res.status(400).json({ error: "Email and code are required." }); return;
    }
    const lowerEmail = String(email).toLowerCase().trim();
    const p = purpose || "signup";
    const [rows] = await pool.query(
      "SELECT * FROM verification_codes WHERE LOWER(email) = ? AND code = ? AND purpose = ? AND used = false ORDER BY created_at DESC LIMIT 1",
      [lowerEmail, code.trim(), p]
    );
    const record = (rows as any[])[0];
    if (!record) {
      res.status(400).json({ error: "Invalid verification code." }); return;
    }
    if (new Date(record.expires_at) < new Date()) {
      res.status(400).json({ error: "Verification code expired. Request a new one." }); return;
    }
    // Mark code as used
    await pool.query("UPDATE verification_codes SET used = true WHERE id = ?", [record.id]);
    // Mark email as verified
    if (p === "signup") {
      const table = record.user_type === "admin" ? "admins" : "shops";
      if (!validateTable(table)) { res.status(400).json({ error: "Invalid user type." }); return; }
      await pool.query(`UPDATE \`${table}\` SET email_verified = true WHERE LOWER(email) = ?`, [lowerEmail]);
    }
    res.json({ ok: true, userType: record.user_type });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// --- Public: Request password reset ---
app.post("/api/db/auth/request-reset", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) { res.status(400).json({ error: "Email is required." }); return; }
    const lowerEmail = String(email).toLowerCase().trim();
    // Find the user in either table
    const [admins] = await pool.query("SELECT id FROM admins WHERE LOWER(email) = ?", [lowerEmail]);
    const [shops] = await pool.query("SELECT id FROM shops WHERE LOWER(email) = ?", [lowerEmail]);
    const isAdmin = (admins as any[]).length > 0;
    const isShop = (shops as any[]).length > 0;
    if (!isAdmin && !isShop) {
      res.status(404).json({ error: "Account with this email does not exist." }); return;
    }
    const userType = isAdmin ? "admin" : "shop";
    const code = "MA-" + Math.floor(100000 + Math.random() * 900000);
    const vcId = "vcode-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await pool.query(
      "INSERT INTO verification_codes (id, email, code, purpose, user_type, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
      [vcId, lowerEmail, code, "password_reset", userType, expiresAt, false]
    );
    try {
      const EMAIL_PORT = process.env.EMAIL_SERVER_PORT || 3001;
      await fetch(`http://localhost:${EMAIL_PORT}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: lowerEmail, subject: "Mi Advantage password reset code", html: `<p>Your password reset code is: <strong>${code}</strong></p><p>Use this code to reset your account password.</p><p>This code expires in 15 minutes.</p>` }),
      });
    } catch { /* email may not be configured */ }
    res.json({ ok: true, message: "Password reset code sent to your email." });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// --- Public: Reset password with code ---
app.post("/api/db/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: "Email, code, and new password are required." }); return;
    }
    const lowerEmail = String(email).toLowerCase().trim();
    const [rows] = await pool.query(
      "SELECT * FROM verification_codes WHERE LOWER(email) = ? AND code = ? AND purpose = 'password_reset' AND used = false ORDER BY created_at DESC LIMIT 1",
      [lowerEmail, code.trim()]
    );
    const record = (rows as any[])[0];
    if (!record) { res.status(400).json({ error: "Invalid reset code." }); return; }
    if (new Date(record.expires_at) < new Date()) {
      res.status(400).json({ error: "Reset code expired." }); return;
    }
    await pool.query("UPDATE verification_codes SET used = true WHERE id = ?", [record.id]);
    const table = record.user_type === "admin" ? "admins" : "shops";
    await pool.query(`UPDATE ${table} SET password = ? WHERE LOWER(email) = ?`, [newPassword, lowerEmail]);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// --- Public: Customer self-registration (no login, no email) ---
// Issues the next sequential CUST-001+ card with 14-day online access.
// Discounts stay blocked (subscription unpaid) until activate-subscription.
app.post("/api/db/auth/register-customer", async (req, res) => {
  try {
    const { name, phone, customer_type, student_id, university, referee_number } = req.body || {};
    const cleanName = String(name || "").trim();
    const cleanPhone = String(phone || "").trim();
    if (!cleanName || !cleanPhone) {
      res.status(400).json({ error: "Full name and phone number are required." }); return;
    }
    const type = customer_type === "student" ? "student" : "other";
    const cleanStudentId = String(student_id || "").trim();
    const cleanUniversity = String(university || "").trim();
    if (type === "student" && (!cleanStudentId || !cleanUniversity)) {
      res.status(400).json({ error: "Student ID and university are required for student members." }); return;
    }
    // Phone is the unique identity for email-less cards.
    const [dup] = await pool.query("SELECT id FROM customers WHERE phone = ? LIMIT 1", [cleanPhone]);
    if ((dup as any[]).length > 0) {
      res.status(409).json({ error: "This phone number is already registered. Use your Card ID at the scan terminal." }); return;
    }
    // Referrer must be a real issued card (CUST-001+ scheme or legacy codes).
    let refCode = String(referee_number || "").trim().toUpperCase();
    if (refCode) {
      if (!/^CUST-\d{3,}$/.test(refCode) && !/^CUST-\d{4}$/.test(refCode)) {
        res.status(400).json({ error: "Referrer code must be a valid CARD ID (e.g. CUST-001)." }); return;
      }
      const [refRows] = await pool.query("SELECT id FROM customers WHERE UPPER(qr_code) = ? LIMIT 1", [refCode]);
      if ((refRows as any[]).length === 0) {
        res.status(400).json({ error: `Referrer ${refCode} not found. Check the CARD ID and retry.` }); return;
      }
    } else {
      refCode = "";
    }
    // Next sequential CUST-001+ code, skipping every taken code.
    const [codeRows] = await pool.query("SELECT qr_code FROM customers");
    const taken = new Set((codeRows as any[]).map((r) => String(r.qr_code || "").toUpperCase().trim()));
    const usedNums = new Set<number>();
    for (const c of taken) {
      const m = /^CUST-(\d+)$/.exec(c);
      if (m) usedNums.add(parseInt(m[1], 10));
    }
    let n = 1;
    let code = "";
    while (true) {
      const candidate = `CUST-${String(n).padStart(3, "0")}`;
      if (!taken.has(candidate) && !usedNums.has(n)) { code = candidate; break; }
      n++;
      if (n > 99999) { code = `CUST-${Date.now().toString().slice(-6)}`; break; }
    }
    const id = "cust-" + Date.now();
    const onlineUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    let hasSubCol = false;
    try {
      const [colRows] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'subscription_status'",
        [DB_NAME],
      );
      hasSubCol = (colRows as any[])[0].cnt > 0;
    } catch { hasSubCol = false; }
    if (!hasSubCol) {
      res.status(500).json({ error: "Database needs the self-registration migration: run mysql-migration-selfreg.sql, then retry." }); return;
    }
    await pool.query(
      "INSERT INTO customers (id, name, email, phone, qr_code, valid_until, customer_type, student_id, university, referee_number, card_status, credit_status, subscription_status) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'suspended', 'pending', 'unpaid')",
      [id, cleanName, cleanPhone, code, onlineUntil, type, type === "student" ? cleanStudentId : "", type === "student" ? cleanUniversity : "", refCode],
    );
    try {
      await pool.query(
        "INSERT INTO audit_logs (id, action, user_role, user_email, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
        [`log-${Date.now()}`, "Customer Self-Registered", "System", "self-registration", `Online card ${code} issued to ${cleanName} (${cleanPhone}). 14-day online access, subscription unpaid.`],
      );
    } catch { /* audit is best-effort */ }
    const [rows] = await pool.query("SELECT * FROM customers WHERE id = ? LIMIT 1", [id]);
    res.json({ customer: (rows as any[])[0] || null });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// --- Public: Subscription activation (mobile-money confirmation) ---
// Flips an unpaid self-registered card to paid/active with 1-year validity.
app.post("/api/db/auth/activate-subscription", async (req, res) => {
  try {
    const { customerId, provider, senderPhone, txCode } = req.body || {};
    const cleanTx = String(txCode || "").trim();
    const cleanSender = String(senderPhone || "").trim();
    if (!customerId || !provider || !cleanSender || !cleanTx) {
      res.status(400).json({ error: "Payment provider, sender phone, and transaction code are required." }); return;
    }
    const allowedProviders = ["MTN MoMo", "Airtel Money"];
    if (!allowedProviders.includes(String(provider))) {
      res.status(400).json({ error: "Unsupported payment provider." }); return;
    }
    const [rows] = await pool.query("SELECT * FROM customers WHERE id = ? LIMIT 1", [customerId]);
    const cust = (rows as any[])[0];
    if (!cust) { res.status(404).json({ error: "Card record not found." }); return; }
    if (cust.subscription_status === "paid" && cust.card_status === "active") {
      res.json({ customer: cust }); return; // idempotent retry
    }
    const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    await pool.query(
      "UPDATE customers SET card_status = 'active', subscription_status = 'paid', valid_until = ? WHERE id = ?",
      [oneYear, customerId],
    );
    try {
      await pool.query(
        "INSERT INTO audit_logs (id, action, user_role, user_email, details, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
        [`log-${Date.now()}`, "Subscription Paid", "System", "self-registration", `Subscription activated for ${cust.qr_code} (${cust.name}) via ${provider}, Tx ${cleanTx}. 1-year validity from ${oneYear}.`],
      );
    } catch { /* audit is best-effort */ }
    const [updated] = await pool.query("SELECT * FROM customers WHERE id = ? LIMIT 1", [customerId]);
    res.json({ customer: (updated as any[])[0] || null });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// ==========================================
// PUBLIC ROUTES (no auth needed)
// ==========================================

app.get("/api/db/test", async (_req, res) => {
  try {
    const conn = await pool.getConnection();
    const tableStatus: Record<string, boolean> = {};
    for (const t of ALLOWED_TABLES) {
      const [rows] = await conn.query(`SHOW TABLES LIKE '${t}'`);
      tableStatus[t] = (rows as any[]).length > 0;
    }
    conn.release();
    res.json({ ok: true, tables: tableStatus });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

app.post("/api/db/seed", async (_req, res) => {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const schemaPath = path.default.join(process.cwd(), "mysql-schema.sql");
    const raw = fs.default.readFileSync(schemaPath, "utf-8");
    const cleaned = raw.split("\n").map(line => {
      const idx = line.indexOf("--");
      return idx >= 0 ? line.substring(0, idx) : line;
    }).join("\n");
    const statements = cleaned.split(";").map(s => s.trim()).filter(s => s.length > 0);
    let executed = 0, errors = 0;
    for (const stmt of statements) {
      const upper = stmt.toUpperCase();
      if (upper.startsWith("CREATE DATABASE") || upper.startsWith("USE ")) continue;
      try { await pool.query(stmt); executed++; } catch (e: any) {
        errors++;
        if (!e?.message?.includes("Duplicate") && !e?.message?.includes("already exists"))
          console.warn("Seed error:", e?.message?.substring(0, 150));
      }
    }
    res.json({ ok: true, message: `${executed} statements OK, ${errors} skipped/duplicate.` });
  } catch (err: any) { res.status(500).json({ ok: false, error: err?.message }); }
});

app.get("/api/db/check-column/:table/:column", async (req, res) => {
  const { table, column } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  if (!isSafeIdentifier(column)) { res.status(400).json({ error: "Invalid column" }); return; }
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [DB_NAME, table, column]
    );
    res.json({ exists: (rows as any[])[0].cnt > 0 });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// ==========================================
// HELPER: Build shop-scoped WHERE clause
// ==========================================

function applyShopScope(table: string, session: Session | undefined, sql: string, params: any[]): { sql: string; params: any[] } {
  // Public (unauthenticated) requests have no session — no extra scoping.
  if (!session) return { sql, params };
  // Shop users can only see their own data in these tables
  if (session.role === "shop") {
    if (table === "sales") {
      // Shops only see their own sales
      const sep = sql.includes("WHERE") ? " AND" : " WHERE";
      return { sql: sql + `${sep} shop_id = ?`, params: [...params, session.shopId] };
    }
    if (table === "shops") {
      // Shops only see their own record
      const sep = sql.includes("WHERE") ? " AND" : " WHERE";
      return { sql: sql + `${sep} id = ?`, params: [...params, session.shopId] };
    }
    if (table === "products") {
      // Shops only see their own product catalog
      const sep = sql.includes("WHERE") ? " AND" : " WHERE";
      return { sql: sql + `${sep} shop_id = ?`, params: [...params, session.shopId] };
    }
    // customers: shops can read all (they need to scan QR codes), but cannot modify admin-only fields
    // audit_logs: shops only see their own logs
    if (table === "audit_logs") {
      const sep = sql.includes("WHERE") ? " AND" : " WHERE";
      return { sql: sql + `${sep} user_email = ?`, params: [...params, session.email] };
    }
  }
  return { sql, params };
}

// ==========================================
// AUTHENTICATED CRUD ROUTES
// ==========================================

app.post("/api/db/batch-update/:table", async (req, res) => {
  const { table } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  // Shop users cannot batch-update customers, admins, or products (ownership-checked single routes instead)
  if (req.session?.role === "shop" && (table === "customers" || table === "admins" || table === "products")) {
    res.status(403).json({ error: "Insufficient permissions." }); return;
  }
  const { ids, data } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !data) {
    res.status(400).json({ error: "Missing ids array or data" }); return;
  }
  if (ids.length > 500) { res.status(400).json({ error: "Too many ids (max 500)." }); return; }
  try {
    const keys = Object.keys(data);
    if (keys.length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    for (const k of keys) {
      if (!isSafeIdentifier(k)) { res.status(400).json({ error: `Invalid column: ${k}` }); return; }
    }
    const setClauses = keys.map(k => `\`${k}\` = ?`).join(", ");
    const placeholders = ids.map(() => "?").join(", ");
    await pool.query(`UPDATE \`${table}\` SET ${setClauses} WHERE id IN (${placeholders})`,
      [...keys.map(k => data[k]), ...ids]);
    res.json({ updated: ids.length });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

app.post("/api/db/:table/upsert", async (req, res) => {
  const { table } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  const body = req.body;
  const rows = Array.isArray(body) ? body : [body];
  try {
    if (rows.length === 0) { res.json({ upserted: 0 }); return; }
    if (rows.length > 500) { res.status(400).json({ error: "Too many rows (max 500)." }); return; }
    const keys = Object.keys(rows[0]);
    if (keys.length === 0) { res.status(400).json({ error: "No fields provided" }); return; }
    for (const k of keys) {
      if (!isSafeIdentifier(k)) { res.status(400).json({ error: `Invalid column: ${k}` }); return; }
    }
    const placeholders = keys.map(() => "?").join(", ");
    const updateClauses = keys.filter(k => k !== "id").map(k => `\`${k}\` = VALUES(\`${k}\`)`).join(", ");
    const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(", ")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClauses}`;
    for (const row of rows) {
      await pool.query(sql, keys.map(k => row[k] ?? null));
    }
    res.json({ upserted: rows.length });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

app.get("/api/db/:table", async (req, res) => {
  const { table } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  try {
    let sql = `SELECT * FROM \`${table}\``;
    let params: any[] = [];
    const metaKeys = new Set(["order", "ascending", "limit", "single", "select"]);
    const filters = Object.entries(req.query).filter(([k]) => !metaKeys.has(k));
    if (filters.length > 0) {
      const conditions: string[] = [];
      for (const [key, value] of filters) {
        if (key.endsWith("_ilike")) {
          const col = key.replace(/_ilike$/, "");
          if (!isSafeIdentifier(col)) { res.status(400).json({ error: `Invalid column: ${col}` }); return; }
          conditions.push(`LOWER(\`${col}\`) LIKE LOWER(?)`);
          params.push(`%${value}%`);
        } else if (key === "used") {
          conditions.push(`\`used\` = ?`);
          params.push(value === "true" ? 1 : 0);
        } else {
          if (!isSafeIdentifier(key)) { res.status(400).json({ error: `Invalid column: ${key}` }); return; }
          conditions.push(`\`${key}\` = ?`);
          params.push(value);
        }
      }
      if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;
    }
    // Apply shop scope (safe when req.session is undefined for public routes)
    const scoped = applyShopScope(table, req.session, sql, params);
    sql = scoped.sql;
    params = scoped.params;

    const orderCol = req.query.order as string;
    if (orderCol) {
      if (!isSafeIdentifier(orderCol)) { res.status(400).json({ error: `Invalid order column: ${orderCol}` }); return; }
      sql += ` ORDER BY \`${orderCol}\` ${req.query.ascending === "true" ? "ASC" : "DESC"}`;
    }
    const limit = req.query.limit as string;
    if (limit) {
      const n = parseInt(limit, 10);
      if (!Number.isFinite(n) || n <= 0 || n > 1000) { res.status(400).json({ error: "Invalid limit (1-1000)." }); return; }
      sql += ` LIMIT ${n}`;
    }
    const [rows] = await pool.query(sql, params);
    if (req.query.single === "true") res.json((rows as any[])[0] || null);
    else res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

app.get("/api/db/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  try {
    let sql = `SELECT * FROM \`${table}\` WHERE id = ?`;
    let params: any[] = [id];
    const scoped = applyShopScope(table, req.session, sql, params);
    const [rows] = await pool.query(scoped.sql, scoped.params);
    res.json((rows as any[])[0] || null);
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

app.post("/api/db/:table", async (req, res) => {
  const { table } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  // Shop users cannot insert into admin-only tables
  if (req.session?.role === "shop" && (table === "admins" || table === "customization")) {
    res.status(403).json({ error: "Insufficient permissions." }); return;
  }
  // Shop users can only create sales under their own shop_id
  if (req.session?.role === "shop" && table === "sales") {
    const bodyRows = Array.isArray(req.body) ? req.body : [req.body];
    for (const row of bodyRows) {
      if (row.shop_id && row.shop_id !== req.session?.shopId) {
        res.status(403).json({ error: "Cannot create sales for another shop." }); return;
      }
      // Force shop_id to the authenticated shop
      row.shop_id = req.session?.shopId;
    }
  }
  // Shop users can only create products under their own shop_id
  if (req.session?.role === "shop" && table === "products") {
    const bodyRows = Array.isArray(req.body) ? req.body : [req.body];
    for (const row of bodyRows) {
      if (row.shop_id && row.shop_id !== req.session?.shopId) {
        res.status(403).json({ error: "Cannot create products for another shop." }); return;
      }
      // Force shop_id to the authenticated shop
      row.shop_id = req.session?.shopId;
    }
  }
  const body = req.body;
  const rows = Array.isArray(body) ? body : [body];
  try {
    if (rows.length === 0) { res.json({ inserted: 0 }); return; }
    if (rows.length > 500) { res.status(400).json({ error: "Too many rows (max 500)." }); return; }
    const keys = Object.keys(rows[0]);
    if (keys.length === 0) { res.status(400).json({ error: "No fields provided" }); return; }
    for (const k of keys) {
      if (!isSafeIdentifier(k)) { res.status(400).json({ error: `Invalid column: ${k}` }); return; }
    }
    const placeholders = keys.map(() => "?").join(", ");
    const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(", ")}) VALUES (${placeholders})`;
    for (const row of rows) {
      await pool.query(sql, keys.map(k => row[k] ?? null));
    }
    res.json({ inserted: rows.length });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

app.put("/api/db/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  // Shop users cannot modify admin-only tables
  if (req.session?.role === "shop" && (table === "admins" || table === "customization" || table === "verification_codes")) {
    res.status(403).json({ error: "Insufficient permissions." }); return;
  }
  // Shops can only update their OWN products (ownership proof)
  if (req.session?.role === "shop" && table === "products") {
    try {
      const [existing] = await pool.query("SELECT shop_id FROM `products` WHERE id = ?", [id]);
      const owner = (existing as any[])[0]?.shop_id;
      if (!owner || owner !== req.session?.shopId) {
        res.status(403).json({ error: "Cannot modify another shop's product." }); return;
      }
    } catch (err: any) { res.status(500).json({ error: err?.message }); return; }
  }
  try {
    const data = req.body;
    const keys = Object.keys(data);
    if (keys.length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    // Shops cannot change their own status or discount_percent
    if (req.session?.role === "shop" && table === "shops") {
      // Ensure shop can only update their own record
      if (id !== req.session?.shopId) {
        res.status(403).json({ error: "Cannot modify another shop's record." }); return;
      }
      delete data.status;
      delete data.discount_percent;
      delete data.email_verified;
    }
    const finalKeys = Object.keys(data);
    if (finalKeys.length === 0) { res.json(null); return; }
    for (const k of finalKeys) {
      if (!isSafeIdentifier(k)) { res.status(400).json({ error: `Invalid column: ${k}` }); return; }
    }
    const setClauses = finalKeys.map(k => `\`${k}\` = ?`).join(", ");
    await pool.query(`UPDATE \`${table}\` SET ${setClauses} WHERE id = ?`,
      [...finalKeys.map(k => data[k]), id]);
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    res.json((rows as any[])[0] || null);
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

app.put("/api/db/:table", async (req, res) => {
  const { table } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  if (req.session?.role === "shop" && (table === "admins" || table === "customization")) {
    res.status(403).json({ error: "Insufficient permissions." }); return;
  }
  try {
    const { data, filters } = req.body;
    if (!data || !filters || typeof filters !== "object") {
      res.status(400).json({ error: "Missing data or filters" }); return;
    }
    const dataKeys = Object.keys(data);
    const filterKeys = Object.keys(filters);
    if (dataKeys.length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    if (filterKeys.length === 0) { res.status(400).json({ error: "No filters provided" }); return; }
    for (const k of [...dataKeys, ...filterKeys]) {
      if (!isSafeIdentifier(k)) { res.status(400).json({ error: `Invalid column: ${k}` }); return; }
    }
    const setClauses = dataKeys.map(k => `\`${k}\` = ?`).join(", ");
    const whereClauses = filterKeys.map(k => `\`${k}\` = ?`).join(" AND ");
    await pool.query(`UPDATE \`${table}\` SET ${setClauses} WHERE ${whereClauses}`,
      [...dataKeys.map(k => data[k]), ...filterKeys.map(k => filters[k])]);
    res.json({ updated: true });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

app.delete("/api/db/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  if (req.session?.role === "shop" && (table === "admins" || table === "customization" || table === "customers")) {
    res.status(403).json({ error: "Insufficient permissions." }); return;
  }
  // Shops can only delete their OWN products (ownership proof)
  if (req.session?.role === "shop" && table === "products") {
    try {
      const [existing] = await pool.query("SELECT shop_id FROM `products` WHERE id = ?", [id]);
      const owner = (existing as any[])[0]?.shop_id;
      if (!owner || owner !== req.session?.shopId) {
        res.status(403).json({ error: "Cannot delete another shop's product." }); return;
      }
    } catch (err: any) { res.status(500).json({ error: err?.message }); return; }
  }
  try {
    await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
    res.json({ deleted: true });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// ==========================================
// GLOBAL ERROR HANDLING — never crash on DB failures
// ==========================================

// Express async errors that escape a handler land here as JSON, not a crash.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("API unhandled error:", err?.message || err);
  if (res.headersSent) return;
  sendDbError(res, err);
});

process.on("unhandledRejection", (reason: any) => {
  console.error("API unhandledRejection:", reason?.message || reason);
});

process.on("uncaughtException", (err: any) => {
  console.error("API uncaughtException:", err?.message || err);
});

// ==========================================
// START
// ==========================================

const PORT = Number(process.env.API_SERVER_PORT || 3002);
const server = app.listen(PORT, async () => {
  console.log(`Mi Advantage API server running on http://localhost:${PORT}`);
  console.log(`MySQL: ${DB_HOST}:${DB_PORT}/${DB_NAME} as ${DB_USER}`);
  console.log(`Auth: token-based sessions (${SESSION_TTL / 3600000}h TTL)`);
  // Startup connectivity probe: warn clearly if MySQL is down, but STAY UP
  // so the frontend receives JSON 503s instead of proxy ECONNRESET.
  try {
    await pool.query("SELECT 1");
    console.log("MySQL: connection OK.");
  } catch (err: any) {
    console.error(`MySQL: ${dbErrorMessage(err)}`);
  }
});
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} already in use.`);
    process.exit(1);
  }
  throw err;
});

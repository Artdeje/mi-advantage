import "dotenv/config";
import express from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import {
  getDb,
  sendDbError,
  dbErrorMessage,
  coerceNumerics,
  escapeLike,
  uid,
  isServiceRole,
  isEmailNotNullError,
} from "./db";

const app = express();
app.use(express.json({ limit: "5mb" }));

app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://mi-advantage.ai.studio");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // Live data must never be served from the browser cache — a revalidated
  // 304 used to wipe the admin lists.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  if (_req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});

// ==========================================
// DATABASE — Supabase (Postgres) via service_role.
// Schema + seed live in supabase-schema.sql (run once in the Supabase
// SQL Editor). The API server is the only data accessor; the browser
// never sees a Supabase key. API contract is unchanged from MySQL days.
// ==========================================

const ALLOWED_TABLES = new Set([
  "admins", "shops", "customers", "sales", "products",
  "audit_logs", "customization", "verification_codes",
]);
function validateTable(t: string) { return ALLOWED_TABLES.has(t); }

// --- Password hashing (bcrypt) ---
import bcrypt from "bcryptjs";
const SALT_ROUNDS = 10;

// Allow only safe SQL identifiers (column names) to prevent injection via
// order/filter/data keys. Table names are already whitelisted above.
function isSafeIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

// --- Rate limiting for auth endpoints ---
const AUTH_RATE_LIMIT = new Map<string, number[]>();
const AUTH_RATE_MAX = 10;
const AUTH_RATE_WINDOW_MS = 60 * 1000;

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
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24h IDLE timeout (sliding)

function createSession(user: Omit<Session, "token" | "createdAt">): Session {
  const token = crypto.randomBytes(32).toString("hex");
  const session: Session = { ...user, token, createdAt: Date.now() };
  sessions.set(token, session);
  return session;
}

function getSession(token: string): Session | null {
  const s = sessions.get(token);
  if (!s) return null;
  const now = Date.now();
  if (now - s.createdAt > SESSION_TTL) { sessions.delete(token); return null; }
  // Sliding expiry: every authenticated request resets the idle timer, so a
  // session in active use never dies mid-work (dashboards 401'd whole sets of
  // data while the public shops list kept working).
  s.createdAt = now;
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
  "/api/health",
  "/health",
]);

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Health checks must always bypass auth immediately (Render, uptime monitors)
  if (req.method === "GET" && (req.path === "/api/health" || req.path === "/health" || req.path.startsWith("/api/health/"))) {
    next();
    return;
  }
  // Non-API traffic (the React frontend, assets) never needs a session token.
  // Without this bypass, GET / hits this middleware and returns the
  // "Authentication required" 401 instead of the welcome page.
  if (!req.path.startsWith("/api/")) { next(); return; }
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
  // Allow unauthenticated customer card lookup (scan terminals / external QR
  // scanners). Both the exact code and the substring form are permitted.
  if (req.method === "GET" && req.path === "/api/db/customers" && (req.query.qr_code || req.query.qr_code_ilike)) { next(); return; }
  // Allow unauthenticated POST to customers (for CustomerPortal QR scan logging)
  if (req.method === "POST" && req.path === "/api/db/customers") { next(); return; }
  // Allow unauthenticated POST to sales (for CustomerPortal transaction creation)
  if (req.method === "POST" && req.path === "/api/db/sales") { next(); return; }
  // Allow unauthenticated GET to audit_logs (for CustomerPortal scan logging)
  if (req.method === "POST" && req.path === "/api/db/audit_logs") { next(); return; }
  // Email delivery + health (merged from email-server.ts so a single
  // production process serves everything; rate-limited + validated below)
  if (req.method === "POST" && req.path === "/api/send-email") { next(); return; }

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
  const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
  const hits = (AUTH_RATE_LIMIT.get(clientIp) || []).filter((t) => Date.now() - t < AUTH_RATE_WINDOW_MS);
  if (hits.length >= AUTH_RATE_MAX) {
    res.status(429).json({ error: "Too many authentication attempts. Please try again later." });
    return;
  }
  hits.push(Date.now());
  AUTH_RATE_LIMIT.set(clientIp, hits);

  try {
    const { email, password } = req.body || {};
    if (!email || !password) { res.status(400).json({ error: "Email and password required." }); return; }
    const lowerEmail = String(email).toLowerCase().trim();

    // Check admins
    const { data: adminRows, error: adminErr } = await getDb()
      .from("admins").select("*").ilike("email", escapeLike(lowerEmail)).limit(1);
    if (adminErr) throw adminErr;
    const admin = (adminRows || [])[0];
    if (admin) {
      let passwordMatch;
      // Try bcrypt first; fall back to plaintext comparison for legacy databases
      try {
        passwordMatch = await bcrypt.compare(password, admin.password || "");
      } catch {
        passwordMatch = password === (admin.password || "");
      }
      if (!passwordMatch) { res.status(401).json({ error: "Invalid password." }); return; }
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
        await getDb().from("audit_logs").insert({
          id: uid("log"), action: "Admin Login", user_role: "Admin",
          user_email: admin.email, details: `Admin ${admin.name} logged in.`,
        });
      } catch (logErr) { console.warn("Login audit log failed:", (logErr as any)?.message); }
      res.json({
        token: session.token,
        user: { id: admin.id, name: admin.name, email: admin.email, role: "admin", admin_role: admin.role },
      });
      return;
    }

    // Check shops
    const { data: shopRows, error: shopErr } = await getDb()
      .from("shops").select("*").ilike("email", escapeLike(lowerEmail)).limit(1);
    if (shopErr) throw shopErr;
    const shop = (shopRows || [])[0];
    if (shop) {
      let passwordMatch;
      // Try bcrypt first; fall back to plaintext comparison for legacy databases
      try {
        passwordMatch = await bcrypt.compare(password, shop.password || "");
      } catch {
        passwordMatch = password === (shop.password || "");
      }
      if (!passwordMatch) { res.status(401).json({ error: "Invalid password." }); return; }
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
        await getDb().from("audit_logs").insert({
          id: uid("log"), action: "Shop Login", user_role: "Shop",
          user_email: shop.email, details: `Shop ${shop.shop_name} logged in.`,
        });
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

// Outbound email from auth flows. Uses this process's own SMTP transporter
// (declared below) so single-service production (Render) needs no second
// email process. Best effort — never blocks the auth flow.
async function sendMailBestEffort(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({ from: `"Mi Advantage" <${SMTP_FROM}>`, to, subject, html });
  } catch { /* email may not be configured */ }
}

// --- Public: Admin registration ---
app.post("/api/db/auth/register-admin", async (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
  const hits = (AUTH_RATE_LIMIT.get(clientIp) || []).filter((t) => Date.now() - t < AUTH_RATE_WINDOW_MS);
  if (hits.length >= AUTH_RATE_MAX) {
    res.status(429).json({ error: "Too many registration attempts. Please try again later." });
    return;
  }
  hits.push(Date.now());
  AUTH_RATE_LIMIT.set(clientIp, hits);

  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required." }); return;
    }
    const lowerEmail = String(email).toLowerCase().trim();
    const adminRole = role && ["super_admin", "admin", "manager"].includes(role) ? role : "admin";
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const { data: existing, error: existingErr } = await getDb()
      .from("admins").select("id").ilike("email", escapeLike(lowerEmail)).limit(1);
    if (existingErr) throw existingErr;
    if ((existing || []).length > 0) {
      res.status(409).json({ error: "An administrator with this email already exists!" }); return;
    }
    const id = uid("admin");
    const { error: insertErr } = await getDb().from("admins").insert({
      id, name, email: lowerEmail, password: hashedPassword, role: adminRole, status: "active", email_verified: false,
    });
    if (insertErr) throw insertErr;
    // Generate and store verification code
    const code = "MA-" + Math.floor(100000 + Math.random() * 900000);
    const vcId = uid("vcode");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: vcErr } = await getDb().from("verification_codes").insert({
      id: vcId, email: lowerEmail, code, purpose: "signup", user_type: "admin",
      expires_at: expiresAt, used: false,
    });
    if (vcErr) throw vcErr;
    // Send email (best effort) via this process's own transporter
    await sendMailBestEffort(lowerEmail, "Verify your Mi Advantage account", `<p>Your verification code is: <strong>${code}</strong></p><p>Use this code to verify your email address and activate your account.</p><p>This code expires in 15 minutes.</p>`);
    res.json({ ok: true, message: "Account created. Check your email for the verification code." });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// --- Public: Verify email code ---
app.post("/api/db/auth/verify-email", async (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
  const hits = (AUTH_RATE_LIMIT.get(clientIp) || []).filter((t) => Date.now() - t < AUTH_RATE_WINDOW_MS);
  if (hits.length >= AUTH_RATE_MAX) {
    res.status(429).json({ error: "Too many verification attempts. Please try again later." });
    return;
  }
  hits.push(Date.now());
  AUTH_RATE_LIMIT.set(clientIp, hits);

  try {
    const { email, code, purpose } = req.body || {};
    if (!email || !code) {
      res.status(400).json({ error: "Email and code are required." }); return;
    }
    const lowerEmail = String(email).toLowerCase().trim();
    const p = purpose || "signup";
    const { data: rows, error: lookupErr } = await getDb()
      .from("verification_codes").select("*")
      .ilike("email", escapeLike(lowerEmail)).eq("code", code.trim()).eq("purpose", p).eq("used", false)
      .order("created_at", { ascending: false }).limit(1);
    if (lookupErr) throw lookupErr;
    const record = (rows || [])[0];
    if (!record) {
      res.status(400).json({ error: "Invalid verification code." }); return;
    }
    if (new Date(record.expires_at) < new Date()) {
      res.status(400).json({ error: "Verification code expired. Request a new one." }); return;
    }
    // Mark code as used
    const { error: usedErr } = await getDb()
      .from("verification_codes").update({ used: true }).eq("id", record.id);
    if (usedErr) throw usedErr;
    // Mark email as verified
    if (p === "signup") {
      const table = record.user_type === "admin" ? "admins" : "shops";
      if (!validateTable(table)) { res.status(400).json({ error: "Invalid user type." }); return; }
      const { error: verifyErr } = await getDb()
        .from(table).update({ email_verified: true }).ilike("email", escapeLike(lowerEmail));
      if (verifyErr) throw verifyErr;
    }
    res.json({ ok: true, userType: record.user_type });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// --- Public: Request password reset ---
app.post("/api/db/auth/request-reset", async (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
  const hits = (AUTH_RATE_LIMIT.get(clientIp) || []).filter((t) => Date.now() - t < AUTH_RATE_WINDOW_MS);
  if (hits.length >= AUTH_RATE_MAX) {
    res.status(429).json({ error: "Too many password reset requests. Please try again later." });
    return;
  }
  hits.push(Date.now());
  AUTH_RATE_LIMIT.set(clientIp, hits);

  try {
    const { email } = req.body || {};
    if (!email) { res.status(400).json({ error: "Email is required." }); return; }
    const lowerEmail = String(email).toLowerCase().trim();
    // Find the user in either table
    const { data: admins, error: adminErr } = await getDb()
      .from("admins").select("id").ilike("email", escapeLike(lowerEmail)).limit(1);
    if (adminErr) throw adminErr;
    const { data: shops, error: shopErr } = await getDb()
      .from("shops").select("id").ilike("email", escapeLike(lowerEmail)).limit(1);
    if (shopErr) throw shopErr;
    const isAdmin = (admins || []).length > 0;
    const isShop = (shops || []).length > 0;
    if (!isAdmin && !isShop) {
      res.status(404).json({ error: "Account with this email does not exist." }); return;
    }
    const userType = isAdmin ? "admin" : "shop";
    const code = "MA-" + Math.floor(100000 + Math.random() * 900000);
    const vcId = uid("vcode");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: vcErr } = await getDb().from("verification_codes").insert({
      id: vcId, email: lowerEmail, code, purpose: "password_reset", user_type: userType,
      expires_at: expiresAt, used: false,
    });
    if (vcErr) throw vcErr;
    await sendMailBestEffort(lowerEmail, "Mi Advantage password reset code", `<p>Your password reset code is: <strong>${code}</strong></p><p>Use this code to reset your account password.</p><p>This code expires in 15 minutes.</p>`);
    res.json({ ok: true, message: "Password reset code sent to your email." });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// --- Public: Reset password with code ---
app.post("/api/db/auth/reset-password", async (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
  const hits = (AUTH_RATE_LIMIT.get(clientIp) || []).filter((t) => Date.now() - t < AUTH_RATE_WINDOW_MS);
  if (hits.length >= AUTH_RATE_MAX) {
    res.status(429).json({ error: "Too many password reset attempts. Please try again later." });
    return;
  }
  hits.push(Date.now());
  AUTH_RATE_LIMIT.set(clientIp, hits);

  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: "Email, code, and new password are required." }); return;
    }
    const lowerEmail = String(email).toLowerCase().trim();
    const { data: rows, error: lookupErr } = await getDb()
      .from("verification_codes").select("*")
      .ilike("email", escapeLike(lowerEmail)).eq("code", code.trim()).eq("purpose", "password_reset").eq("used", false)
      .order("created_at", { ascending: false }).limit(1);
    if (lookupErr) throw lookupErr;
    const record = (rows || [])[0];
    if (!record) { res.status(400).json({ error: "Invalid reset code." }); return; }
    if (new Date(record.expires_at) < new Date()) {
      res.status(400).json({ error: "Reset code expired." }); return;
    }
    const { error: usedErr } = await getDb()
      .from("verification_codes").update({ used: true }).eq("id", record.id);
    if (usedErr) throw usedErr;
    const table = record.user_type === "admin" ? "admins" : "shops";
    const { error: pwErr } = await getDb()
      .from(table).update({ password: newPassword }).ilike("email", escapeLike(lowerEmail));
    if (pwErr) throw pwErr;
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
    const { data: dup, error: dupErr } = await getDb()
      .from("customers").select("id").eq("phone", cleanPhone).limit(1);
    if (dupErr) throw dupErr;
    if ((dup || []).length > 0) {
      res.status(409).json({ error: "This phone number is already registered. Use your Card ID at the scan terminal." }); return;
    }
    // Referrer must be a real issued card (CUST-001+ scheme or legacy codes).
    let refCode = String(referee_number || "").trim().toUpperCase();
    if (refCode) {
      if (!/^CUST-\d{3,}$/.test(refCode) && !/^CUST-\d{4}$/.test(refCode)) {
        res.status(400).json({ error: "Referrer code must be a valid CARD ID (e.g. CUST-001)." }); return;
      }
      const { data: refRows, error: refErr } = await getDb()
        .from("customers").select("id").ilike("qr_code", escapeLike(refCode)).limit(1);
      if (refErr) throw refErr;
      if ((refRows || []).length === 0) {
        res.status(400).json({ error: `Referrer ${refCode} not found. Check the CARD ID and retry.` }); return;
      }
    } else {
      refCode = "";
    }
    // Next sequential CUST-001+ code, skipping every taken code.
    const taken = new Set<string>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: codeRows, error: codeErr } = await getDb()
        .from("customers").select("qr_code").range(from, from + PAGE - 1);
      if (codeErr) throw codeErr;
      const batch = codeRows || [];
      for (const r of batch) taken.add(String((r as any).qr_code || "").toUpperCase().trim());
      if (batch.length < PAGE) break;
    }
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
    const id = uid("cust");
    const onlineUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    // supabase-schema.sql guarantees subscription_status — no migration probe needed.
    const customerRow: Record<string, any> = {
      id, name: cleanName, phone: cleanPhone, qr_code: code, valid_until: onlineUntil,
      customer_type: type, student_id: type === "student" ? cleanStudentId : "",
      university: type === "student" ? cleanUniversity : "", referee_number: refCode,
      card_status: "suspended", credit_status: "pending", subscription_status: "unpaid",
    };
    let { error: custErr } = await getDb().from("customers").insert(customerRow);
    if (custErr && isEmailNotNullError(custErr)) {
      // Some live databases still declare customers.email NOT NULL while the
      // intended schema makes it nullable. Retry once with a deterministic
      // placeholder so self-registration never fails for email-less cards.
      customerRow.email = `card-${code.toLowerCase()}@cards.mi-advantage.local`;
      const retry = await getDb().from("customers").insert(customerRow);
      custErr = retry.error;
    }
    if (custErr) throw custErr;
    try {
      await getDb().from("audit_logs").insert({
        id: uid("log"), action: "Customer Self-Registered", user_role: "System",
        user_email: "self-registration",
        details: `Online card ${code} issued to ${cleanName} (${cleanPhone}). 14-day online access, subscription unpaid.`,
      });
    } catch { /* audit is best-effort */ }
    const { data: created, error: createdErr } = await getDb()
      .from("customers").select("*").eq("id", id).maybeSingle();
    if (createdErr) throw createdErr;
    res.json({ customer: created || null });
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
    const { data: cust, error: custErr } = await getDb()
      .from("customers").select("*").eq("id", customerId).maybeSingle();
    if (custErr) throw custErr;
    if (!cust) { res.status(404).json({ error: "Card record not found." }); return; }
    if (cust.subscription_status === "paid" && cust.card_status === "active") {
      res.json({ customer: cust }); return; // idempotent retry
    }
    const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { error: actErr } = await getDb()
      .from("customers")
      .update({ card_status: "active", subscription_status: "paid", valid_until: oneYear })
      .eq("id", customerId);
    if (actErr) throw actErr;
    try {
      await getDb().from("audit_logs").insert({
        id: uid("log"), action: "Subscription Paid", user_role: "System",
        user_email: "self-registration",
        details: `Subscription activated for ${cust.qr_code} (${cust.name}) via ${provider}, Tx ${cleanTx}. 1-year validity from ${oneYear}.`,
      });
    } catch { /* audit is best-effort */ }
    const { data: updated, error: updatedErr } = await getDb()
      .from("customers").select("*").eq("id", customerId).maybeSingle();
    if (updatedErr) throw updatedErr;
    res.json({ customer: updated || null });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// ==========================================
// PUBLIC ROUTES (no auth needed)
// ==========================================

app.get("/api/db/test", async (_req, res) => {
  try {
    const db = getDb();
    const tableStatus: Record<string, boolean> = {};
    for (const t of ALLOWED_TABLES) {
      const { error } = await db.from(t).select("id", { head: true, count: "exact" });
      tableStatus[t] = !error;
    }
    res.json({ ok: true, tables: tableStatus });
  } catch (err: any) {
    sendDbError(res, err);
  }
});

// Lightweight session check for the client boot path. The auth middleware
// above already verified the Bearer token; no DB round-trip needed.
app.get("/api/db/auth/validate", (_req, res) => {
  res.json({ valid: true });
});

// Lightweight session check for the client boot path. The auth middleware
// above already verified the Bearer token; no DB round-trip needed.
app.get("/api/db/auth/validate", (_req, res) => {
  res.json({ valid: true });
});

// Default seed (idempotent upserts). For existing MySQL data, use the
// one-off migration script instead: npm run db:seed-supabase
const DEFAULT_SEED: Record<string, any[]> = {
  admins: [
    { id: "admin-1", name: "Super Administrator", email: "artdeje@mail.com", password: "admin123", role: "super_admin", status: "active", email_verified: true },
  ],
  shops: [
    { id: "shop-1", shop_name: "Kigali Fashion House", discount_percent: 12, email: "kigalifashion@shop.com", password: "shop123", status: "approved", email_verified: true, qr_code: "SHOP-1001" },
    { id: "shop-2", shop_name: "Simba Supermarket", discount_percent: 8, email: "simba@shop.com", password: "shop123", status: "approved", email_verified: true, qr_code: "SHOP-1002" },
    { id: "shop-3", shop_name: "Inzora Rooftop Cafe", discount_percent: 15, email: "inzora@shop.com", password: "shop123", status: "approved", email_verified: true, qr_code: "SHOP-1003" },
    { id: "shop-4", shop_name: "Gisenyi Beach Resort", discount_percent: 20, email: "gisenyiresort@shop.com", password: "shop123", status: "approved", email_verified: true, qr_code: "SHOP-1004" },
  ],
  customers: [
    { id: "cust-1", name: "Jean Luc Mutara", email: "jeanluc@example.com", phone: "+250788123456", qr_code: "CUST-9821", valid_until: "2027-07-01", customer_type: "student", student_id: "STU-2023-0451", university: "University of Rwanda", referee_number: "", card_status: "active", credit_status: "pending", subscription_status: "paid" },
    { id: "cust-2", name: "Aline Uwase", email: "aline@example.com", phone: "+250788654321", qr_code: "CUST-1123", valid_until: "2026-08-10", customer_type: "other", student_id: "", university: "", referee_number: "CUST-9821", card_status: "renew", credit_status: "pending", subscription_status: "paid" },
    { id: "cust-3", name: "Eric Ndahiro", email: "ericn@example.com", phone: "+250789555666", qr_code: "CUST-4567", valid_until: "2027-07-03", customer_type: "other", student_id: "", university: "", referee_number: "CUST-9821", card_status: "active", credit_status: "pending", subscription_status: "paid" },
    { id: "cust-4", name: "Marie Claire Uwineza", email: "claire@example.com", phone: "+250782111222", qr_code: "CUST-3049", valid_until: "2027-07-04", customer_type: "student", student_id: "STU-2024-1187", university: "Kigali Independent University", referee_number: "CUST-1123", card_status: "active", credit_status: "pending", subscription_status: "paid" },
    { id: "cust-5", name: "Divine Karemera", email: "divine@example.com", phone: "+250783999888", qr_code: "CUST-8072", valid_until: "2027-07-05", customer_type: "other", student_id: "", university: "", referee_number: "CUST-1123", card_status: "active", credit_status: "pending", subscription_status: "paid" },
  ],
  products: [
    { id: "prod-1", shop_id: "shop-1", name: "Kitenge Dress", price: 25000, stock: 20, description: "Vibrant Ankara print dress, tailored fit.", status: "active" },
    { id: "prod-2", shop_id: "shop-1", name: "Men Shirt", price: 18000, stock: 35, description: "Classic cotton shirt, all sizes.", status: "active" },
    { id: "prod-3", shop_id: "shop-2", name: "Milk 1L", price: 2000, stock: 100, description: "Fresh whole milk 1 litre.", status: "active" },
    { id: "prod-4", shop_id: "shop-2", name: "Bread 500g", price: 1500, stock: 80, description: "Daily baked brown bread.", status: "active" },
    { id: "prod-5", shop_id: "shop-3", name: "Cappuccino", price: 3500, stock: 50, description: "Double-shot cappuccino with art.", status: "active" },
    { id: "prod-6", shop_id: "shop-4", name: "Day Pass", price: 15000, stock: 30, description: "Full-day resort access with lunch.", status: "active" },
  ],
  customization: [
    { id: "global-config", theme_color: "green", title: "Mi Advantage QR Card Scan & Shop", subtitle: "Member Privilege Program", scan_title: "Member Scan & Loyalty Terminal", scan_subtitle: "Scan customer membership cards in real-time to compute discounts and record transaction logs.", home_h1: "Instant Merchant Discounts", home_h2: "QR Member Advantage System", home_p: "Scan your digital member card at any registered partner outlet to instantly redeem high-value discount privileges. Connect with top local merchants, supermarkets, and cafes seamlessly." },
  ],
};

app.post("/api/db/seed", async (req, res) => {
  // Re-seeding is an administrator-only maintenance action: it overwrites
  // global branding and demo rows, so it must never be public.
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "Administrator session required." });
    return;
  }
  try {
    const db = getDb();
    let upserted = 0;
    const skipped: string[] = [];
    for (const [table, rows] of Object.entries(DEFAULT_SEED)) {
      const { error } = await db.from(table).upsert(rows, { onConflict: "id" });
      if (error) skipped.push(`${table} (${error.message})`);
      else upserted += rows.length;
    }
    res.json({ ok: true, message: `${upserted} rows upserted${skipped.length ? `, skipped: ${skipped.join("; ")}` : ""}.` });
  } catch (err: any) { sendDbError(res, err); }
});

app.get("/api/db/check-column/:table/:column", async (req, res) => {
  const { table, column } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  if (!isSafeIdentifier(column)) { res.status(400).json({ error: "Invalid column" }); return; }
  try {
    const { data, error } = await getDb().from(table).select(column).limit(1);
    if (error) {
      if (/column .* does not exist|does not exist/i.test(error.message)) {
        res.json({ exists: false }); return;
      }
      throw error;
    }
    void data;
    res.json({ exists: true });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// ==========================================
// HELPER: Shop-scoped query builder
// ==========================================

// Shop users can only see their own data in these tables.
// Public (unauthenticated) requests have no session — no extra scoping.
// (customers: shops can read all — they need to scan QR codes;
//  audit_logs: shops only see their own logs.)
function scopeQuery<T>(table: string, session: Session | undefined, q: T): T {
  if (!session || session.role !== "shop") return q;
  const b = q as any;
  if (table === "sales" || table === "products") return b.eq("shop_id", session.shopId);
  if (table === "shops") return b.eq("id", session.shopId);
  if (table === "audit_logs") return b.eq("user_email", session.email);
  return q;
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
    const { error } = await getDb().from(table).update(data).in("id", ids);
    if (error) throw error;
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
    const { error } = await getDb().from(table).upsert(rows, { onConflict: "id" });
    if (error) throw error;
    res.json({ upserted: rows.length });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

app.get("/api/db/:table", async (req, res) => {
  const { table } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  try {
    let q = getDb().from(table).select("*");
    const metaKeys = new Set(["order", "ascending", "limit", "offset", "single", "select"]);
    const filters = Object.entries(req.query).filter(([k]) => !metaKeys.has(k));
    for (const [key, value] of filters) {
      const v = String(value);
      if (key.endsWith("_ilike")) {
        const col = key.replace(/_ilike$/, "");
        if (!isSafeIdentifier(col)) { res.status(400).json({ error: `Invalid column: ${col}` }); return; }
        // The client may send a ready-made pattern (e.g. "%CUST-01%"). Only
        // wrap with wildcards when the caller did not supply its own, otherwise
        // "%%CUST-01%%" would be parsed by SQL LIKE as a literal percent sign
        // and the card would never be found.
        const pattern = v.includes("%") ? v : `%${escapeLike(v)}%`;
        q = q.ilike(col, pattern);
      } else if (key === "used") {
        // Postgres stores real booleans (old MySQL layer mapped TINYINT 1/0).
        q = q.eq("used", v === "true");
      } else {
        if (!isSafeIdentifier(key)) { res.status(400).json({ error: `Invalid column: ${key}` }); return; }
        q = q.eq(key, v);
      }
    }
    // Apply shop scope (safe when req.session is undefined for public routes)
    q = scopeQuery(table, req.session, q);

    const orderCol = req.query.order as string;
    if (orderCol) {
      if (!isSafeIdentifier(orderCol)) { res.status(400).json({ error: `Invalid order column: ${orderCol}` }); return; }
      q = q.order(orderCol, { ascending: req.query.ascending === "true" });
    }
    const limit = req.query.limit as string;
    const offset = req.query.offset as string;
    let lim = 1000;
    if (limit) {
      const n = parseInt(limit, 10);
      if (!Number.isFinite(n) || n <= 0 || n > 1000) { res.status(400).json({ error: "Invalid limit (1-1000)." }); return; }
      lim = n;
    }
    if (offset) {
      const o = parseInt(offset, 10);
      if (!Number.isFinite(o) || o < 0 || o > 1000000) { res.status(400).json({ error: "Invalid offset (0-1000000)." }); return; }
      // PostgREST caps a single response at 1000 rows, so paging via Range
      // is the only way to walk past the first 1000 (e.g. >1000 member cards).
      q = q.range(o, o + lim - 1);
    } else if (limit) {
      q = q.limit(lim);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    const out = coerceNumerics(table, rows || []);
    if (req.query.single === "true") res.json((out as any[])[0] || null);
    else res.json(out);
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

app.get("/api/db/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  if (!validateTable(table)) { res.status(400).json({ error: "Invalid table" }); return; }
  try {
    const q = scopeQuery(table, req.session,
      getDb().from(table).select("*").eq("id", id));
    const { data: row, error } = await q.maybeSingle();
    if (error) throw error;
    res.json(coerceNumerics(table, row || null));
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
    const clean = rows.map((row: any) => {
      const o: any = {};
      for (const k of keys) o[k] = row[k] ?? null;
      return o;
    });
    let { error } = await getDb().from(table).insert(clean);
    if (error && table === "customers" && isEmailNotNullError(error)) {
      // customers.email is nullable in the intended schema, but some live
      // databases still declare it NOT NULL. Issuing a card for a member with
      // no email must never fail, so retry once with a deterministic
      // placeholder derived from the card ID.
      const patched = clean.map((row: any) => ({
        ...row,
        email:
          row.email ||
          `card-${String(row.qr_code || row.id || "unknown").toLowerCase()}@cards.mi-advantage.local`,
      }));
      const retry = await getDb().from(table).insert(patched);
      error = retry.error;
    }
    if (error) throw error;
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
      const { data: existing, error: ownerErr } = await getDb()
        .from("products").select("shop_id").eq("id", id).maybeSingle();
      if (ownerErr) throw ownerErr;
      const owner = (existing as any)?.shop_id;
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
    const { data: updated, error } = await getDb()
      .from(table).update(data).eq("id", id).select();
    if (error) throw error;
    res.json(coerceNumerics(table, (updated || [])[0] || null));
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
    const { error } = await getDb().from(table).update(data).match(filters);
    if (error) throw error;
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
      const { data: existing, error: ownerErr } = await getDb()
        .from("products").select("shop_id").eq("id", id).maybeSingle();
      if (ownerErr) throw ownerErr;
      const owner = (existing as any)?.shop_id;
      if (!owner || owner !== req.session?.shopId) {
        res.status(403).json({ error: "Cannot delete another shop's product." }); return;
      }
    } catch (err: any) { res.status(500).json({ error: err?.message }); return; }
  }
  try {
    const { error } = await getDb().from(table).delete().eq("id", id);
    if (error) throw error;
    res.json({ deleted: true });
  } catch (err: any) { res.status(500).json({ error: err?.message }); }
});

// ==========================================
// EMAIL (merged from email-server.ts)
// A single production process (Render) can only expose ONE port, so the
// API server also handles /api/send-email + /api/health. Local dev may
// still run server/email-server.ts separately — same contract.
// ==========================================

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
const SMTP_FROM = process.env.SMTP_FROM_EMAIL || SMTP_USER;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  // Never let a blocked/slow SMTP host hang a request (or the health check)
  // forever — fail fast with a clear error instead.
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

const emailRateLimit = new Map<string, number[]>();
const EMAIL_RATE_MAX = 30;
const EMAIL_RATE_WINDOW_MS = 60 * 1000;

function isEmailRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (emailRateLimit.get(ip) || []).filter((t) => now - t < EMAIL_RATE_WINDOW_MS);
  hits.push(now);
  emailRateLimit.set(ip, hits);
  return hits.length > EMAIL_RATE_MAX;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Liveness probe. MUST answer instantly and never depend on an outbound
// network call: Render (and other hosts) fail the health check — leaving the
// app stuck on the "Application loading" page — if this is slow. SMTP status
// is reported as configuration only; the deep check lives at /api/health/smtp.
app.get(["/api/health", "/health", "/api/health/"], (_req, res) => {
  res.json({
    ok: true,
    smtp: Boolean(SMTP_USER && SMTP_PASS),
    from: SMTP_FROM,
    uptime: Math.round(process.uptime()),
  });
});

// Deep SMTP check (optional, admin-authenticated). Bounded by transporter
// timeouts so it can never hang the process.
app.get("/api/health/smtp", async (_req, res) => {
  if (!SMTP_USER || !SMTP_PASS) {
    res.status(503).json({ ok: false, smtp: false, error: "SMTP credentials not configured." });
    return;
  }
  try {
    await transporter.verify();
    res.json({ ok: true, smtp: true, from: SMTP_FROM });
  } catch (err: any) {
    res.status(503).json({ ok: false, smtp: false, error: err?.message || "SMTP verification failed" });
  }
});

app.post("/api/send-email", async (req, res) => {
  const { to, subject, html } = req.body || {};
  if (!to || !subject || !html) {
    res.status(400).json({ success: false, error: "Missing to, subject or html." });
    return;
  }
  if (typeof to !== "string" || !isValidEmail(to)) {
    res.status(400).json({ success: false, error: "Invalid recipient email address." });
    return;
  }
  if (typeof subject !== "string" || subject.length === 0 || subject.length > 200) {
    res.status(400).json({ success: false, error: "Invalid subject (1-200 chars)." });
    return;
  }
  if (typeof html !== "string" || html.length === 0 || html.length > 50000) {
    res.status(400).json({ success: false, error: "Invalid email body (1-50000 chars)." });
    return;
  }
  const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
  if (isEmailRateLimited(clientIp)) {
    res.status(429).json({ success: false, error: "Too many email requests. Please try again later." });
    return;
  }
  if (!SMTP_USER || !SMTP_PASS) {
    res.status(500).json({ success: false, error: "SMTP credentials not configured." });
    return;
  }
  try {
    await transporter.sendMail({
      from: `"Mi Advantage" <${SMTP_FROM}>`,
      to,
      subject,
      html,
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Email send failure:", err);
    res.status(500).json({ success: false, error: err?.message || "Failed to send email" });
  }
});

// ==========================================
// STATIC FRONTEND (production single-service)
// Serves the Vite build (dist/) so one Render Web Service hosts both the
// React app and the API. Unknown /api/* paths stay JSON 404s; every other
// unmatched GET falls back to index.html (HashRouter resolves the route).
// ==========================================

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const DIST_DIR = path.join(process.cwd(), "dist");
if (fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  app.use(express.static(DIST_DIR));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
} else {
  console.warn("Frontend dist/ not found — API-only mode. Run: npm run build");
}

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

// Render (and most hosts) inject PORT — it must win over the local dev ports.
// Bind explicitly to 0.0.0.0 so the platform's proxy/health checker can reach
// it regardless of IPv4/IPv6 defaults.
const PORT = Number(process.env.PORT || process.env.API_SERVER_PORT || 3002);
const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Mi Advantage API server running on http://localhost:${PORT}`);
  console.log(`DB: Supabase ${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "(not configured)"}`);
  if (!isServiceRole()) {
    console.warn("DB: running with anon key — writes obey table RLS policies. For full access, set SUPABASE_SERVICE_ROLE_KEY.");
  }
  console.log(`Auth: token-based sessions (${SESSION_TTL / 3600000}h TTL)`);
  // Startup connectivity probe: warn clearly if Supabase is down, but STAY UP
  // so the frontend receives JSON 503s instead of proxy ECONNRESET.
  try {
    const { error } = await getDb().from("customization").select("id", { head: true });
    if (error) throw error;
    console.log("Supabase: connection OK.");
  } catch (err: any) {
    console.error(`Supabase: ${dbErrorMessage(err)}`);
  }
});
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} already in use.`);
    process.exit(1);
  }
  throw err;
});

import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json({ limit: "1mb" }));

// CORS for direct browser calls (when not using the Vite proxy)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
const SMTP_FROM = process.env.SMTP_FROM_EMAIL || SMTP_USER;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// Simple in-memory rate limiting to prevent open-relay abuse.
// Allows 30 emails per minute per IP.
const emailRateLimit = new Map<string, number[]>();
const EMAIL_RATE_MAX = 30;
const EMAIL_RATE_WINDOW_MS = 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (emailRateLimit.get(ip) || []).filter((t) => now - t < EMAIL_RATE_WINDOW_MS);
  hits.push(now);
  emailRateLimit.set(ip, hits);
  return hits.length > EMAIL_RATE_MAX;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.get("/api/health", async (_req, res) => {
  if (!SMTP_USER || !SMTP_PASS) {
    res.json({ ok: true, smtp: false, error: "SMTP credentials not configured in .env" });
    return;
  }
  try {
    await transporter.verify();
    res.json({ ok: true, smtp: true, from: SMTP_FROM });
  } catch (err: any) {
    res.json({ ok: true, smtp: false, error: err?.message || "SMTP verification failed" });
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
  if (isRateLimited(clientIp)) {
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

app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = Number(process.env.EMAIL_SERVER_PORT || 3001);
const server = app.listen(PORT, () => {
  console.log(`Mi Advantage email server running on http://localhost:${PORT}`);
  console.log(`SMTP: ${SMTP_HOST}:${SMTP_PORT} as ${SMTP_USER}`);
});
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Kill the existing process first or use a different port.`);
    process.exit(1);
  }
  throw err;
});

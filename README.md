# Mi Advantage — QR Card Scan & Shop Discount Management

QR member-card discount system with Admin, Shop, and public Customer scan portals.
Frontend: React 19 + Vite 6 + Tailwind 4. Backend: Express + Supabase (Postgres) + Nodemailer SMTP.

## Quick start

Prerequisites: Node.js 20+, a Supabase project.

1. Install dependencies:
   `npm install`
2. Copy env and configure:
   `copy .env.example .env` (Windows) or `cp .env.example .env`
   Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_*` in `.env`. Leave `VITE_API_URL=""` and
   `VITE_EMAIL_API_URL=""` empty for Vite dev proxy.
3. Create tables + seed (run once in Supabase Dashboard → SQL Editor):
   `supabase-schema.sql`
4. Run all (API :3002 + email :3001 + Vite :3000):
   `npm run dev`

## Scripts

- `npm run dev` — API + email + Vite concurrently
- `npm run api` — Supabase API server only (`server/api-server.ts`, port `API_SERVER_PORT` / 3002)
- `npm run email` — SMTP email server only (`server/email-server.ts`, port `EMAIL_SERVER_PORT` / 3001)
- `npm run db:seed-supabase` — one-off MySQL → Supabase data migration (needs local MySQL up + `SUPABASE_*` set)
- `npm run db:init` — legacy local MySQL schema + seed via `mysql-schema.sql` (only for MySQL dev)
- `npm run lint` — `tsc --noEmit`
- `npm run build` — production build: Vite frontend + bundled API server (`dist/server.js`)
- `npm run build:server` — bundle `server/api-server.ts` → `dist/server.js` only
- `npm start` — run the production single-service bundle (frontend + API + email)
- `npm run preview` — preview production build

## Environment

See `.env.example` for all variables:

- `VITE_API_URL`, `VITE_EMAIL_API_URL` — leave empty in dev (Vite proxy) and on
  single-service production (same-origin `/api/...`). Only set explicit URLs if
  the API lives on a different host.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase project URL + **secret**
  service_role key (server only; never put any key in `VITE_*`)
- `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE` — only for the one-off MySQL → Supabase migration
- `API_SERVER_PORT`, `EMAIL_SERVER_PORT`
- `SMTP_HOST/PORT/USER/PASS/FROM_EMAIL` — Gmail app password
- `APP_URL` — public URL of the app
- `PORT` — respected first by the server (Render injects it); falls back to `API_SERVER_PORT`/3002 locally

## Deploy on Render (single Web Service)

`render.yaml` pre-fills everything. One service hosts the React app + API + email:

1. Create a project at https://supabase.com/dashboard.
2. Run `supabase-schema.sql` once in the Supabase Dashboard → SQL Editor
   (creates all 8 tables + seed, RLS locked to service_role).
3. Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars in the Render dashboard.
4. Set `SMTP_*` env vars (Gmail App Password, no spaces).
5. Build Command: `npm install && npm run build` — Start Command: `node dist/server.js`.
6. Seed once after deploy — either carry over MySQL data (start local MySQL, then
   `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed-supabase`)
   or POST to `/api/db/seed` once the service is up for default demo data.
7. Health check: `GET /api/health`.

## Default credentials (change in production!)

- Admin: `artdeje@mail.com` / `admin123`
- Shops: `kigalifashion@shop.com`, `simba@shop.com`, `inzora@shop.com`, `gisenyiresort@shop.com` / `shop123`

## Security notes

- Passwords are currently stored as plaintext for local XAMPP dev. Hash (bcrypt/argon2) before production.
- API uses in-memory token sessions (24h TTL, hourly purge). Use Redis/JWT + persistent store for multi-instance production.
- Email endpoint is rate-limited (30/min/IP) with recipient/subject/body validation.
- All dynamic table/column identifiers are whitelisted/validated server-side; row limits capped (1000 read, 500 write).
- `.env` is git-ignored — never commit real SMTP credentials. Rotate any credentials previously committed.

## Guest shopping (no member card)

1. Every shop carries a `SHOP-####` code (auto-issued on creation; "Ensure shop QRs"
   backfills any missing). Admin → Partners → click a shop's QR → Download PNG →
   print for the counter.
2. Customer opens the Scan page → Guest Shopping tab → scans the shop QR (camera or typed code).
3. After scanning, a sliding strip shows the other partner shops (logo + name + discount).
4. Guest adds products (name/price/qty) to the cart, checks out with the shop discount applied,
   and gets a printable receipt. The sale is recorded without any shop-operator scan.

Shop terminals: Shop dashboard → **Scan Card** button opens the scanner popup
(camera + manual code) → a valid scan closes the popup and reveals the discount
form below with customer ID + name filled → enter amount → save. The welcome
tab otherwise shows charts only (top-customers pie, daily/weekly/monthly/annual
sales line).
## Customer self-registration (no login, no email)

1. Existing databases: run `mysql-migration-selfreg.sql` once (nullable customer email,
   `subscription_status`, shop `description`).
2. Admin → Partners → "Self-Registration QR" → Download PNG → print & post at counters.
   It opens the public card-issuing page (`#/join`) with a partner-shop carousel on top
   (tap any card for the business details) and the registration form below.
3. The form asks for name, phone, member type (+ student ID/university for students) and an
   optional referrer Card ID — no email. Submitting issues the next sequential Card ID
   (`CUST-001`, `CUST-002`, …) with a free 14-day online card (downloadable PDF).
4. Discounts stay blocked until the subscription is paid (mobile-money Tx code on the same
   page) — payment activates the card for a full year ahead of the physical card.
5. After registering, the customer gets a personal referring QR: anyone scanning it lands on
   the same issuing form with them prefilled as referrer.

Guest checkout without login: Scan page → Guest Shopping → Step 1 scans the shop QR
(shop autoselected) → Step 2 scans the member card the discount is placed on → cart →
receipt. Unpaid/expired cards are rejected with the reason shown.

## Shop products menu (CRUD)

1. Existing databases: run `mysql-migration-products.sql` once (fresh installs include it).
2. Shop account → Products tab → full menu management: list with search, add, edit,
   hide/show, delete. Each shop only ever sees and edits its own catalog (server-enforced
   `shop_id` scoping on read/create/update/delete).
3. Cards show price (RWF), stock (out-of-stock flagged), and visibility status.

## Admin notes
- Member cards: QR Cards tab shows the issued-cards list with a prominent
  **Register New Card** button (opens the issuing form as a modal; row Edit reopens
  the same modal prefilled, row Delete removes). All members are general —
  the student type was removed from every registration form (admin, self-registration).
- Partners: the registry list (pending applications stay in their own approvals block,
  no duplicates) ships with an **Add New Partner** button opening the same full
  create/edit modal used by row Edit, plus per-row Generate QR, approve/reject,
  edit, and delete actions. Success/error feedback appears on the list.
- Settings groups Branding, Admins, and Audit Logs (legacy Supabase Database
  panel removed). Brand Colors stack 1/2/4 across phone/tablet/desktop with
  non-overflowing inputs.
- Admin sidebar groups Branding, Admins, Database, and Audit Logs under one
  expandable **Settings** menu (desktop icon rail, mobile drawer, and direct
  URLs like `#/logs` all keep working). Analytics keeps KPIs and top-outlet
  charts only.
- Branding (Settings → Branding) edits the platform title and site favicon
  (upload or URL) — both apply live across the portal and browser tab.
- Shop dashboard opens clean (stats + charts); the scanner + discount form appear
  only after clicking **Scan Card**. Dashboard charts: top-5 purchasing-customers
  pie (+Others) and a Daily/Weekly/Monthly/Annual sales-trend line.
- Admin (Branding) and shop (Account) settings, all tables, and all modals are
  responsive from phones to desktops (scrollable tables, collapsing grids,
  viewport-capped dialogs).

## Dark theme

Every screen supports a full dark theme (slate-950/900 surfaces, tinted
emerald/amber/red status boxes, adapted text/borders/inputs/hover states —
accent buttons, scanner viewfinders, QR codes, and charts keep their contrast).
Toggle with the sun/moon button in any nav bar or dashboard header; the choice
persists in the browser (system preference is the default).

-- =========================================================
-- SUPABASE (POSTGRES) SCHEMA & SEED FOR MI ADVANTAGE
-- Run once in the Supabase Dashboard → SQL Editor (or via psql).
-- This replaces mysql-schema.sql + all mysql-migration-*.sql files:
-- every column from every migration is already included below.
--
-- Access model: Row Level Security is ENABLED on all tables with NO
-- public policies — only the service_role key (used by server/api-server.ts)
-- can read/write. The anon key cannot touch app data. Never expose the
-- service_role key in the browser (VITE_*); set it as SUPABASE_SERVICE_ROLE_KEY
-- on the server (Render env vars) only.
-- =========================================================

-- 1. ADMINS TABLE
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'active',
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SHOPS TABLE (includes qr_code + description from later migrations)
CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    shop_name TEXT NOT NULL,
    discount_percent INTEGER NOT NULL DEFAULT 10,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    profile_picture TEXT,
    qr_code TEXT UNIQUE,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    contract TEXT,
    rdb_certificate TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CUSTOMERS TABLE (email nullable + subscription_status included)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT NOT NULL,
    qr_code TEXT NOT NULL UNIQUE,
    valid_until DATE,
    customer_type TEXT NOT NULL DEFAULT 'other',
    student_id TEXT DEFAULT '',
    university TEXT DEFAULT '',
    referee_number TEXT DEFAULT '',
    card_status TEXT NOT NULL DEFAULT 'active',
    credit_status TEXT NOT NULL DEFAULT 'pending',
    subscription_status TEXT NOT NULL DEFAULT 'unpaid',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCTS TABLE (per-shop menu catalog)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    shop_id TEXT REFERENCES shops(id) ON UPDATE CASCADE ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);

-- 5. SALES TABLE
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    shop_id TEXT REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL,
    customer_id TEXT REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL,
    shop_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    amount_before_discount NUMERIC(12,2) NOT NULL,
    discount_percent INTEGER NOT NULL,
    discount_applied NUMERIC(12,2) NOT NULL,
    final_amount NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

-- 6. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    user_role TEXT NOT NULL,
    user_email TEXT NOT NULL,
    details TEXT NOT NULL,
    admin_id TEXT REFERENCES admins(id) ON UPDATE CASCADE ON DELETE SET NULL,
    shop_id TEXT REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL,
    customer_id TEXT REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_id ON audit_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_customer_id ON audit_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- 7. CUSTOMIZATION TABLE (singleton row id = 'global-config')
CREATE TABLE IF NOT EXISTS customization (
    id TEXT PRIMARY KEY,
    theme_color TEXT NOT NULL DEFAULT 'green',
    logo_url TEXT DEFAULT '',
    favicon_url TEXT DEFAULT '',
    title TEXT NOT NULL DEFAULT 'Mi Advantage QR Card Scan & Shop',
    subtitle TEXT DEFAULT 'Kigali Premium Privilege',
    primary_color TEXT DEFAULT '#059669',
    secondary_color TEXT DEFAULT '#0d9488',
    accent_color TEXT DEFAULT '#f59e0b',
    background_color TEXT DEFAULT '#f8fafc',
    sidebar_color TEXT DEFAULT '#ffffff',
    card_color TEXT DEFAULT '#ffffff',
    text_primary_color TEXT DEFAULT '#1e293b',
    text_secondary_color TEXT DEFAULT '#64748b',
    font_family TEXT DEFAULT 'Inter',
    heading_font TEXT DEFAULT 'Space Grotesk',
    base_font_size TEXT DEFAULT '14px',
    home_h1 TEXT DEFAULT 'Instant Merchant Discounts',
    home_h2 TEXT DEFAULT 'QR Member Advantage System',
    home_p TEXT DEFAULT 'Scan your digital member card at any registered partner outlet in Kigali to instantly redeem high-value discount privileges.',
    login_heading TEXT DEFAULT 'Partner Shop Terminal',
    login_subtext TEXT DEFAULT 'Authorized Merchants Only',
    signup_heading TEXT DEFAULT 'Register Your Shop',
    signup_subtext TEXT DEFAULT 'Submit your business details for admin approval',
    login_background_type TEXT DEFAULT 'gradient',
    login_background_value TEXT DEFAULT 'linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%)',
    footer_text TEXT DEFAULT '',
    footer_subtext TEXT DEFAULT '',
    email_header_html TEXT DEFAULT '',
    email_footer_html TEXT DEFAULT '',
    custom_css TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keep updated_at fresh on every UPDATE (replaces MySQL ON UPDATE CURRENT_TIMESTAMP)
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customization_updated_at ON customization;
CREATE TRIGGER trg_customization_updated_at
  BEFORE UPDATE ON customization
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- 8. VERIFICATION CODES TABLE
CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'signup',
    user_type TEXT NOT NULL DEFAULT 'shop',
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);

-- =========================================================
-- ROW LEVEL SECURITY — locked down, service_role only.
-- The API server authenticates with the service_role key, which
-- bypasses RLS. No policies are created on purpose: the anon/public
-- key gets zero access to app data.
-- =========================================================
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customization ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SEED DATA (idempotent — safe to re-run)
-- =========================================================

INSERT INTO admins (id, name, email, password, role, status, email_verified)
VALUES ('admin-1', 'Super Administrator', 'artdeje@mail.com', 'admin123', 'super_admin', 'active', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO shops (id, shop_name, discount_percent, email, password, status, email_verified, qr_code)
VALUES
    ('shop-1', 'Kigali Fashion House', 12, 'kigalifashion@shop.com', 'shop123', 'approved', true, 'SHOP-1001'),
    ('shop-2', 'Simba Supermarket', 8, 'simba@shop.com', 'shop123', 'approved', true, 'SHOP-1002'),
    ('shop-3', 'Inzora Rooftop Cafe', 15, 'inzora@shop.com', 'shop123', 'approved', true, 'SHOP-1003'),
    ('shop-4', 'Gisenyi Beach Resort', 20, 'gisenyiresort@shop.com', 'shop123', 'approved', true, 'SHOP-1004')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (id, name, email, phone, qr_code, valid_until, customer_type, student_id, university, referee_number, card_status, credit_status, subscription_status)
VALUES
    ('cust-1', 'Jean Luc Mutara', 'jeanluc@example.com', '+250788123456', 'CUST-9821', '2027-07-01', 'student', 'STU-2023-0451', 'University of Rwanda', '', 'active', 'pending', 'paid'),
    ('cust-2', 'Aline Uwase', 'aline@example.com', '+250788654321', 'CUST-1123', '2026-08-10', 'other', '', '', 'CUST-9821', 'renew', 'pending', 'paid'),
    ('cust-3', 'Eric Ndahiro', 'ericn@example.com', '+250789555666', 'CUST-4567', '2027-07-03', 'other', '', '', 'CUST-9821', 'active', 'pending', 'paid'),
    ('cust-4', 'Marie Claire Uwineza', 'claire@example.com', '+250782111222', 'CUST-3049', '2027-07-04', 'student', 'STU-2024-1187', 'Kigali Independent University', 'CUST-1123', 'active', 'pending', 'paid'),
    ('cust-5', 'Divine Karemera', 'divine@example.com', '+250783999888', 'CUST-8072', '2027-07-05', 'other', '', '', 'CUST-1123', 'active', 'pending', 'paid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, shop_id, name, price, stock, description, status)
VALUES
    ('prod-1', 'shop-1', 'Kitenge Dress', 25000, 20, 'Vibrant Ankara print dress, tailored fit.', 'active'),
    ('prod-2', 'shop-1', 'Men Shirt', 18000, 35, 'Classic cotton shirt, all sizes.', 'active'),
    ('prod-3', 'shop-2', 'Milk 1L', 2000, 100, 'Fresh whole milk 1 litre.', 'active'),
    ('prod-4', 'shop-2', 'Bread 500g', 1500, 80, 'Daily baked brown bread.', 'active'),
    ('prod-5', 'shop-3', 'Cappuccino', 3500, 50, 'Double-shot cappuccino with art.', 'active'),
    ('prod-6', 'shop-4', 'Day Pass', 15000, 30, 'Full-day resort access with lunch.', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customization (id, theme_color, title, subtitle, home_h1, home_h2, home_p)
VALUES (
    'global-config',
    'green',
    'Mi Advantage QR Card Scan & Shop',
    'Kigali Premium Privilege',
    'Instant Merchant Discounts',
    'QR Member Advantage System',
    'Scan your digital member card at any registered partner outlet in Kigali to instantly redeem high-value discount privileges. Connect with top local merchants, supermarkets, and cafes seamlessly.'
)
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- SUPABASE SCHEMAS & INITIAL SEED FOR MI ADVANTAGE DISCOUNT APP
-- Execute this SQL script in your Supabase SQL Editor
-- =========================================================

-- 1. ADMINS TABLE (role: super_admin manages admins; admin cannot self-register)
CREATE TABLE IF NOT EXISTS public.admins (
    id TEXT PRIMARY KEY DEFAULT ('admin-' || extract(epoch from now())::bigint),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    status TEXT NOT NULL DEFAULT 'active',
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SHOPS TABLE (self-registered shops start as pending until admin approves)
CREATE TABLE IF NOT EXISTS public.shops (
    id TEXT PRIMARY KEY DEFAULT ('shop-' || extract(epoch from now())::bigint),
    shop_name TEXT NOT NULL,
    discount_percent INTEGER NOT NULL DEFAULT 10 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    profile_picture TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    contract TEXT,
    rdb_certificate TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY DEFAULT ('cust-' || extract(epoch from now())::bigint),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    qr_code TEXT UNIQUE NOT NULL,
    valid_until DATE,
    customer_type TEXT NOT NULL DEFAULT 'other',
    student_id TEXT DEFAULT '',
    university TEXT DEFAULT '',
    referee_number TEXT DEFAULT '',
    card_status TEXT NOT NULL DEFAULT 'active',
    credit_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Migration: add customer profile columns if upgrading existing DB
DO $$
BEGIN
    ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'other';
    ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS student_id TEXT DEFAULT '';
    ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS university TEXT DEFAULT '';
    ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS referee_number TEXT DEFAULT '';
    ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS card_status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_status TEXT NOT NULL DEFAULT 'pending';
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- 4. SALES / TRANSACTIONS TABLE (With explicit foreign keys relating to both shops and customers)
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY DEFAULT ('sale-' || extract(epoch from now())::bigint),
    shop_id TEXT REFERENCES public.shops(id) ON UPDATE CASCADE ON DELETE SET NULL,
    customer_id TEXT REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL,
    shop_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    amount_before_discount NUMERIC(12,2) NOT NULL,
    discount_percent INTEGER NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_applied NUMERIC(12,2) NOT NULL,
    final_amount NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for faster FK lookups and date queries
CREATE INDEX IF NOT EXISTS idx_sales_shop_id ON public.sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);

-- 5. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('log-' || extract(epoch from now())::bigint),
    action TEXT NOT NULL,
    user_role TEXT NOT NULL,
    user_email TEXT NOT NULL,
    details TEXT NOT NULL,
    admin_id TEXT REFERENCES public.admins(id) ON UPDATE CASCADE ON DELETE SET NULL,
    shop_id TEXT REFERENCES public.shops(id) ON UPDATE CASCADE ON DELETE SET NULL,
    customer_id TEXT REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON public.audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_id ON public.audit_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_customer_id ON public.audit_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- 6. CUSTOMIZATION / BRANDING TABLE (Full CRUD branding)
CREATE TABLE IF NOT EXISTS public.customization (
    id TEXT PRIMARY KEY DEFAULT 'global-config',
    -- Core branding
    theme_color TEXT NOT NULL DEFAULT 'green',
    logo_url TEXT DEFAULT '',
    favicon_url TEXT DEFAULT '',
    title TEXT NOT NULL DEFAULT 'Mi Advantage QR Card Scan & Shop',
    subtitle TEXT DEFAULT 'Kigali Premium Privilege',
    -- Colors
    primary_color TEXT DEFAULT '#059669',
    secondary_color TEXT DEFAULT '#0d9488',
    accent_color TEXT DEFAULT '#f59e0b',
    background_color TEXT DEFAULT '#f8fafc',
    sidebar_color TEXT DEFAULT '#ffffff',
    card_color TEXT DEFAULT '#ffffff',
    text_primary_color TEXT DEFAULT '#1e293b',
    text_secondary_color TEXT DEFAULT '#64748b',
    -- Typography
    font_family TEXT DEFAULT 'Inter',
    heading_font TEXT DEFAULT 'Space Grotesk',
    base_font_size TEXT DEFAULT '14px',
    -- Homepage content
    home_h1 TEXT DEFAULT 'Instant Merchant Discounts',
    home_h2 TEXT DEFAULT 'QR Member Advantage System',
    home_p TEXT DEFAULT 'Scan your digital member card at any registered partner outlet in Kigali to instantly redeem high-value discount privileges.',
    -- Login & Signup
    login_heading TEXT DEFAULT 'Partner Shop Terminal',
    login_subtext TEXT DEFAULT 'Authorized Merchants Only',
    signup_heading TEXT DEFAULT 'Register Your Shop',
    signup_subtext TEXT DEFAULT 'Submit your business details for admin approval',
    login_background_type TEXT DEFAULT 'gradient',
    login_background_value TEXT DEFAULT 'linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%)',
    -- Footer
    footer_text TEXT DEFAULT '',
    footer_subtext TEXT DEFAULT '',
    -- Email branding
    email_header_html TEXT DEFAULT '',
    email_footer_html TEXT DEFAULT '',
    -- Custom CSS/JS
    custom_css TEXT DEFAULT '',
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Migration: add new columns if upgrading existing DB
DO $$
BEGIN
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#059669';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#0d9488';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#f59e0b';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#f8fafc';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS sidebar_color TEXT DEFAULT '#ffffff';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT '#ffffff';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS text_primary_color TEXT DEFAULT '#1e293b';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS text_secondary_color TEXT DEFAULT '#64748b';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'Inter';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS heading_font TEXT DEFAULT 'Space Grotesk';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS base_font_size TEXT DEFAULT '14px';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS login_background_type TEXT DEFAULT 'gradient';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS login_background_value TEXT DEFAULT 'linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%)';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS footer_text TEXT DEFAULT '';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS footer_subtext TEXT DEFAULT '';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS email_header_html TEXT DEFAULT '';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS email_footer_html TEXT DEFAULT '';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS custom_css TEXT DEFAULT '';
    ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
EXCEPTION
    WHEN duplicate_column THEN NULL;
END $$;

-- 7. VERIFICATION CODES TABLE (email verification + password reset codes)
CREATE TABLE IF NOT EXISTS public.verification_codes (
    id TEXT PRIMARY KEY DEFAULT ('vcode-' || extract(epoch from now())::bigint || '-' || floor(random()*1000)::int),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'signup',
    user_type TEXT NOT NULL DEFAULT 'shop',
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON public.verification_codes(email);

-- =========================================================
-- ENABLE ROW LEVEL SECURITY (RLS) & ACCESS POLICIES
-- =========================================================
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read & write for full dynamic functionality
CREATE POLICY "Allow public select admins" ON public.admins FOR SELECT USING (true);
CREATE POLICY "Allow public insert admins" ON public.admins FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update admins" ON public.admins FOR UPDATE USING (true);
CREATE POLICY "Allow public delete admins" ON public.admins FOR DELETE USING (true);

CREATE POLICY "Allow public select shops" ON public.shops FOR SELECT USING (true);
CREATE POLICY "Allow public insert shops" ON public.shops FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update shops" ON public.shops FOR UPDATE USING (true);
CREATE POLICY "Allow public delete shops" ON public.shops FOR DELETE USING (true);

CREATE POLICY "Allow public select customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update customers" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete customers" ON public.customers FOR DELETE USING (true);

CREATE POLICY "Allow public select sales" ON public.sales FOR SELECT USING (true);
CREATE POLICY "Allow public insert sales" ON public.sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update sales" ON public.sales FOR UPDATE USING (true);
CREATE POLICY "Allow public delete sales" ON public.sales FOR DELETE USING (true);

CREATE POLICY "Allow public select audit_logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select customization" ON public.customization FOR SELECT USING (true);
CREATE POLICY "Allow public insert customization" ON public.customization FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update customization" ON public.customization FOR UPDATE USING (true);

CREATE POLICY "Allow public select verification_codes" ON public.verification_codes FOR SELECT USING (true);
CREATE POLICY "Allow public insert verification_codes" ON public.verification_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update verification_codes" ON public.verification_codes FOR UPDATE USING (true);

-- =========================================================
-- INITIAL SEED DATA
-- =========================================================
INSERT INTO public.admins (id, name, email, password, role, status, email_verified)
VALUES ('admin-1', 'Super Administrator', 'artdeje@mail.com', 'admin123', 'super_admin', 'active', true)
ON CONFLICT (email) DO UPDATE SET role = 'super_admin', status = 'active', email_verified = true;

INSERT INTO public.shops (id, shop_name, discount_percent, email, password, status, email_verified)
VALUES
    ('shop-1', 'Kigali Fashion House', 12, 'kigalifashion@shop.com', 'shop123', 'approved', true),
    ('shop-2', 'Simba Supermarket', 8, 'simba@shop.com', 'shop123', 'approved', true),
    ('shop-3', 'Inzora Rooftop Cafe', 15, 'inzora@shop.com', 'shop123', 'approved', true),
    ('shop-4', 'Gisenyi Beach Resort', 20, 'gisenyiresort@shop.com', 'shop123', 'approved', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, name, email, phone, qr_code, valid_until, customer_type, student_id, university, referee_number, card_status, credit_status)
VALUES 
    ('cust-1', 'Jean Luc Mutara', 'jeanluc@example.com', '+250788123456', 'CUST-9821', '2027-07-01', 'student', 'STU-2023-0451', 'University of Rwanda', '', 'active', 'pending'),
    ('cust-2', 'Aline Uwase', 'aline@example.com', '+250788654321', 'CUST-1123', '2026-08-10', 'other', '', '', 'CUST-9821', 'renew', 'pending'),
    ('cust-3', 'Eric Ndahiro', 'ericn@example.com', '+250789555666', 'CUST-4567', '2027-07-03', 'other', '', '', 'CUST-9821', 'active', 'pending'),
    ('cust-4', 'Marie Claire Uwineza', 'claire@example.com', '+250782111222', 'CUST-3049', '2027-07-04', 'student', 'STU-2024-1187', 'Kigali Independent University', 'CUST-1123', 'active', 'pending'),
    ('cust-5', 'Divine Karemera', 'divine@example.com', '+250783999888', 'CUST-8072', '2027-07-05', 'other', '', '', 'CUST-1123', 'active', 'pending')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customization (id, theme_color, title, subtitle, home_h1, home_h2, home_p)
VALUES (
    'global-config', 
    'green', 
    'Mi Advantage QR Card Scan & Shop', 
    'Kigali Premium Privilege', 
    'Instant Merchant Discounts', 
    'QR Member Advantage System', 
    'Scan your digital member card at any registered partner outlet in Kigali to instantly redeem high-value discount privileges. Connect with top local merchants, supermarkets, and cafes seamlessly.'
) ON CONFLICT (id) DO NOTHING;

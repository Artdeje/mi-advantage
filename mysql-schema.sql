-- =========================================================
-- MYSQL SCHEMA & SEED FOR MI ADVANTAGE DISCOUNT APP
-- Execute this in phpMyAdmin or MySQL CLI (XAMPP)
-- =========================================================

CREATE DATABASE IF NOT EXISTS mi_advantage
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mi_advantage;

-- 1. ADMINS TABLE
CREATE TABLE IF NOT EXISTS admins (
    id VARCHAR(100) PRIMARY KEY,
    name TEXT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. SHOPS TABLE
CREATE TABLE IF NOT EXISTS shops (
    id VARCHAR(100) PRIMARY KEY,
    shop_name TEXT NOT NULL,
    discount_percent INT NOT NULL DEFAULT 10,
    email VARCHAR(255) NOT NULL UNIQUE,
    password TEXT,
    profile_picture TEXT,
    qr_code VARCHAR(50) UNIQUE,
    description TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    contract TEXT,
    rdb_certificate TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(100) PRIMARY KEY,
    name TEXT NOT NULL,
    email VARCHAR(255) NULL UNIQUE,
    phone TEXT NOT NULL,
    qr_code VARCHAR(50) NOT NULL UNIQUE,
    valid_until DATE,
    customer_type VARCHAR(20) NOT NULL DEFAULT 'other',
    student_id TEXT DEFAULT '',
    university TEXT DEFAULT '',
    referee_number TEXT DEFAULT '',
    card_status VARCHAR(20) NOT NULL DEFAULT 'active',
    credit_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. PRODUCTS TABLE (per-shop menu catalog, managed by shop accounts)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(100) PRIMARY KEY,
    shop_id VARCHAR(100),
    name TEXT NOT NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_products_shop_id ON products(shop_id);

-- 5. SALES TABLE
CREATE TABLE IF NOT EXISTS sales (
    id VARCHAR(100) PRIMARY KEY,
    shop_id VARCHAR(100),
    customer_id VARCHAR(100),
    shop_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    amount_before_discount DECIMAL(12,2) NOT NULL,
    discount_percent INT NOT NULL,
    discount_applied DECIMAL(12,2) NOT NULL,
    final_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_sales_shop_id ON sales(shop_id);
CREATE INDEX idx_sales_customer_id ON sales(customer_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);

-- 6. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    action TEXT NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    user_email TEXT NOT NULL,
    details TEXT NOT NULL,
    admin_id VARCHAR(100),
    shop_id VARCHAR(100),
    customer_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (shop_id) REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_shop_id ON audit_logs(shop_id);
CREATE INDEX idx_audit_logs_customer_id ON audit_logs(customer_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- 7. CUSTOMIZATION TABLE (singleton row)
CREATE TABLE IF NOT EXISTS customization (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'global-config',
    theme_color VARCHAR(30) NOT NULL DEFAULT 'green',
    logo_url TEXT DEFAULT '',
    favicon_url TEXT DEFAULT '',
    title TEXT NOT NULL DEFAULT 'Mi Advantage QR Card Scan & Shop',
    subtitle TEXT DEFAULT 'Kigali Premium Privilege',
    primary_color VARCHAR(20) DEFAULT '#059669',
    secondary_color VARCHAR(20) DEFAULT '#0d9488',
    accent_color VARCHAR(20) DEFAULT '#f59e0b',
    background_color VARCHAR(20) DEFAULT '#f8fafc',
    sidebar_color VARCHAR(20) DEFAULT '#ffffff',
    card_color VARCHAR(20) DEFAULT '#ffffff',
    text_primary_color VARCHAR(20) DEFAULT '#1e293b',
    text_secondary_color VARCHAR(20) DEFAULT '#64748b',
    font_family VARCHAR(100) DEFAULT 'Inter',
    heading_font VARCHAR(100) DEFAULT 'Space Grotesk',
    base_font_size VARCHAR(10) DEFAULT '14px',
    home_h1 TEXT DEFAULT 'Instant Merchant Discounts',
    home_h2 TEXT DEFAULT 'QR Member Advantage System',
    home_p TEXT DEFAULT 'Scan your digital member card at any registered partner outlet in Kigali to instantly redeem high-value discount privileges.',
    login_heading TEXT DEFAULT 'Partner Shop Terminal',
    login_subtext TEXT DEFAULT 'Authorized Merchants Only',
    signup_heading TEXT DEFAULT 'Register Your Shop',
    signup_subtext TEXT DEFAULT 'Submit your business details for admin approval',
    login_background_type VARCHAR(20) DEFAULT 'gradient',
    login_background_value TEXT DEFAULT 'linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%)',
    footer_text TEXT DEFAULT '',
    footer_subtext TEXT DEFAULT '',
    email_header_html TEXT DEFAULT '',
    email_footer_html TEXT DEFAULT '',
    custom_css TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 8. VERIFICATION CODES TABLE
CREATE TABLE IF NOT EXISTS verification_codes (
    id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(20) NOT NULL,
    purpose VARCHAR(20) NOT NULL DEFAULT 'signup',
    user_type VARCHAR(20) NOT NULL DEFAULT 'shop',
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_codes_email ON verification_codes(email);

-- =========================================================
-- SEED DATA
-- =========================================================

INSERT IGNORE INTO admins (id, name, email, password, role, status, email_verified)
VALUES ('admin-1', 'Super Administrator', 'artdeje@mail.com', 'admin123', 'super_admin', 'active', true);

INSERT IGNORE INTO shops (id, shop_name, discount_percent, email, password, status, email_verified, qr_code)
VALUES
    ('shop-1', 'Kigali Fashion House', 12, 'kigalifashion@shop.com', 'shop123', 'approved', true, 'SHOP-1001'),
    ('shop-2', 'Simba Supermarket', 8, 'simba@shop.com', 'shop123', 'approved', true, 'SHOP-1002'),
    ('shop-3', 'Inzora Rooftop Cafe', 15, 'inzora@shop.com', 'shop123', 'approved', true, 'SHOP-1003'),
    ('shop-4', 'Gisenyi Beach Resort', 20, 'gisenyiresort@shop.com', 'shop123', 'approved', true, 'SHOP-1004');

INSERT IGNORE INTO customers (id, name, email, phone, qr_code, valid_until, customer_type, student_id, university, referee_number, card_status, credit_status, subscription_status)
VALUES
    ('cust-1', 'Jean Luc Mutara', 'jeanluc@example.com', '+250788123456', 'CUST-9821', '2027-07-01', 'student', 'STU-2023-0451', 'University of Rwanda', '', 'active', 'pending', 'paid'),
    ('cust-2', 'Aline Uwase', 'aline@example.com', '+250788654321', 'CUST-1123', '2026-08-10', 'other', '', '', 'CUST-9821', 'renew', 'pending', 'paid'),
    ('cust-3', 'Eric Ndahiro', 'ericn@example.com', '+250789555666', 'CUST-4567', '2027-07-03', 'other', '', '', 'CUST-9821', 'active', 'pending', 'paid'),
    ('cust-4', 'Marie Claire Uwineza', 'claire@example.com', '+250782111222', 'CUST-3049', '2027-07-04', 'student', 'STU-2024-1187', 'Kigali Independent University', 'CUST-1123', 'active', 'pending', 'paid'),
    ('cust-5', 'Divine Karemera', 'divine@example.com', '+250783999888', 'CUST-8072', '2027-07-05', 'other', '', '', 'CUST-1123', 'active', 'pending', 'paid');

INSERT IGNORE INTO products (id, shop_id, name, price, stock, description, status)
VALUES
    ('prod-1', 'shop-1', 'Kitenge Dress', 25000, 20, 'Vibrant Ankara print dress, tailored fit.', 'active'),
    ('prod-2', 'shop-1', 'Men Shirt', 18000, 35, 'Classic cotton shirt, all sizes.', 'active'),
    ('prod-3', 'shop-2', 'Milk 1L', 2000, 100, 'Fresh whole milk 1 litre.', 'active'),
    ('prod-4', 'shop-2', 'Bread 500g', 1500, 80, 'Daily baked brown bread.', 'active'),
    ('prod-5', 'shop-3', 'Cappuccino', 3500, 50, 'Double-shot cappuccino with art.', 'active'),
    ('prod-6', 'shop-4', 'Day Pass', 15000, 30, 'Full-day resort access with lunch.', 'active');

INSERT IGNORE INTO customization (id, theme_color, title, subtitle, home_h1, home_h2, home_p)
VALUES (
    'global-config',
    'green',
    'Mi Advantage QR Card Scan & Shop',
    'Kigali Premium Privilege',
    'Instant Merchant Discounts',
    'QR Member Advantage System',
    'Scan your digital member card at any registered partner outlet in Kigali to instantly redeem high-value discount privileges. Connect with top local merchants, supermarkets, and cafes seamlessly.'
);

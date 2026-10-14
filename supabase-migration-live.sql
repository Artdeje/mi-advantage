-- =========================================================
-- LIVE-PROJECT MIGRATION for wbldciermnpgmlsookrs (has live data!)
-- Run once in Supabase Dashboard → SQL Editor.
-- Adds the 3 columns the app needs, opens products for the API's
-- key (same style as this project's existing public policies),
-- and backfills counter QR codes for the 4 existing shops.
-- Safe to re-run (IF NOT EXISTS / WHERE qr_code IS NULL).
-- =========================================================

-- 1. Missing columns (present in mysql-schema.sql, absent in live DB)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS qr_code TEXT UNIQUE;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'unpaid';

-- 2. Products table: allow the API key full access
-- (mirrors this project's existing "Allow public ..." policies)
DROP POLICY IF EXISTS "Allow public select products" ON products;
DROP POLICY IF EXISTS "Allow public insert products" ON products;
DROP POLICY IF EXISTS "Allow public update products" ON products;
DROP POLICY IF EXISTS "Allow public delete products" ON products;
CREATE POLICY "Allow public select products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public insert products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update products" ON products FOR UPDATE USING (true);
CREATE POLICY "Allow public delete products" ON products FOR DELETE USING (true);

-- 3. Backfill counter QR codes for existing shops (only where missing)
UPDATE shops SET qr_code = sub.code
FROM (VALUES
  ('kigalifashion@shop.com', 'SHOP-1001'),
  ('simba@shop.com',         'SHOP-1002'),
  ('inzora@shop.com',        'SHOP-1003'),
  ('gisenyiresort@shop.com', 'SHOP-1004')
) AS sub(email, code)
WHERE shops.email = sub.email AND shops.qr_code IS NULL;

-- 4. Default product catalog (only inserts missing ids)
INSERT INTO products (id, shop_id, name, price, stock, description, status)
VALUES
    ('prod-1', 'shop-1', 'Kitenge Dress', 25000, 20, 'Vibrant Ankara print dress, tailored fit.', 'active'),
    ('prod-2', 'shop-1', 'Men Shirt', 18000, 35, 'Classic cotton shirt, all sizes.', 'active'),
    ('prod-3', 'shop-2', 'Milk 1L', 2000, 100, 'Fresh whole milk 1 litre.', 'active'),
    ('prod-4', 'shop-2', 'Bread 500g', 1500, 80, 'Daily baked brown bread.', 'active'),
    ('prod-5', 'shop-3', 'Cappuccino', 3500, 50, 'Double-shot cappuccino with art.', 'active'),
    ('prod-6', 'shop-4', 'Day Pass', 15000, 30, 'Full-day resort access with lunch.', 'active')
ON CONFLICT (id) DO NOTHING;

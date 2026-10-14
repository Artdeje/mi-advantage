-- =========================================================
-- MIGRATION: guest-scan QR codes for shops
-- Run this in phpMyAdmin / MySQL CLI on EXISTING databases.
-- (Fresh installs already include qr_code via mysql-schema.sql)
-- =========================================================

USE mi_advantage;

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS qr_code VARCHAR(50) UNIQUE AFTER profile_picture;

-- Backfill existing approved demo shops (adjust to your data)
UPDATE shops SET qr_code = 'SHOP-1001' WHERE id = 'shop-1' AND qr_code IS NULL;
UPDATE shops SET qr_code = 'SHOP-1002' WHERE id = 'shop-2' AND qr_code IS NULL;
UPDATE shops SET qr_code = 'SHOP-1003' WHERE id = 'shop-3' AND qr_code IS NULL;
UPDATE shops SET qr_code = 'SHOP-1004' WHERE id = 'shop-4' AND qr_code IS NULL;

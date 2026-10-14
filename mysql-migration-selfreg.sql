-- =========================================================
-- MIGRATION: customer self-registration (no email) + subscriptions
-- Run this in phpMyAdmin / MySQL CLI on EXISTING databases.
-- (Fresh installs already include these via mysql-schema.sql)
-- =========================================================

USE mi_advantage;

-- 1. Self-registered customers have no email: allow NULL.
--    (MySQL permits multiple NULLs under the existing UNIQUE key.)
ALTER TABLE customers MODIFY email VARCHAR(255) NULL;

-- 2. Subscription lifecycle for self-registered cards:
--    'unpaid' (registered, discounts blocked) -> 'paid' (active, 1-year card).
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' AFTER credit_status;

-- Existing admin-issued cards are treated as paid/active already.
UPDATE customers SET subscription_status = 'paid' WHERE card_status = 'active';

-- 3. Partner business description shown in the self-registration
--    carousel detail view (editable by admin / shop account).
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '' AFTER qr_code;

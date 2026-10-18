-- =========================================================
-- MIGRATION v7 — Editable landing page content & background
-- Run in Supabase SQL Editor
-- Adds homepage content columns to the customization table:
--   home_background_type, home_background_value
--   feature1_title, feature1_desc
--   feature2_title, feature2_desc
--   feature3_title, feature3_desc
-- =========================================================

ALTER TABLE public.customization
    ADD COLUMN IF NOT EXISTS home_background_type TEXT DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS home_background_value TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS feature1_title TEXT DEFAULT 'Partner Outlets',
    ADD COLUMN IF NOT EXISTS feature1_desc TEXT DEFAULT 'Approved merchants across Kigali offer exclusive member discounts.',
    ADD COLUMN IF NOT EXISTS feature2_title TEXT DEFAULT 'Instant Savings',
    ADD COLUMN IF NOT EXISTS feature2_desc TEXT DEFAULT 'Discounts are computed in real-time at the checkout terminal.',
    ADD COLUMN IF NOT EXISTS feature3_title TEXT DEFAULT 'Member Cards',
    ADD COLUMN IF NOT EXISTS feature3_desc TEXT DEFAULT 'Every member gets unique QR credentials.';

-- Backfill existing row with defaults
UPDATE public.customization
SET
    home_background_type = COALESCE(home_background_type, 'none'),
    home_background_value = COALESCE(home_background_value, ''),
    feature1_title = COALESCE(feature1_title, 'Partner Outlets'),
    feature1_desc = COALESCE(feature1_desc, 'Approved merchants across Kigali offer exclusive member discounts.'),
    feature2_title = COALESCE(feature2_title, 'Instant Savings'),
    feature2_desc = COALESCE(feature2_desc, 'Discounts are computed in real-time at the checkout terminal.'),
    feature3_title = COALESCE(feature3_title, 'Member Cards'),
    feature3_desc = COALESCE(feature3_desc, 'Every member gets unique QR credentials.')
WHERE id = 'global-config';

-- =========================================================
-- MIGRATION: shop business type + discount scope
-- Run once in the Supabase Dashboard -> SQL Editor (or psql).
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).
--
-- Adds two optional shops columns used by the "Register Your Shop"
-- page and the admin Add-Shop modal:
--   business_type   : retail | restaurant | cafe | hotel | services | other
--   discount_scope  : all | drinks | food | rooms | services
--
-- The app degrades gracefully until this is run (create/update simply
-- omit the fields), so there is no downtime either way.
-- =========================================================

ALTER TABLE shops ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'retail';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS discount_scope TEXT NOT NULL DEFAULT 'all';

-- Backfill any pre-existing rows that arrived before the DEFAULT applied.
UPDATE shops SET business_type = 'retail' WHERE business_type IS NULL;
UPDATE shops SET discount_scope = 'all' WHERE discount_scope IS NULL;

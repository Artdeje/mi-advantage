-- =========================================================
-- CUSTOMER PROFILE MIGRATION v3 — Run in Supabase SQL Editor
-- Adds Student/Other membership type fields to customers
-- =========================================================

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'other',
    ADD COLUMN IF NOT EXISTS student_id TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS university TEXT DEFAULT '';

-- Backfill existing rows: mark any card issued with an ID prefix that
-- looks like a student profile (optional). Defaults to 'other' otherwise.
UPDATE public.customers
SET customer_type = 'other'
WHERE customer_type IS NULL OR customer_type = '';

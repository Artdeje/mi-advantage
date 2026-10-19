-- =========================================================
-- MIGRATION v8 — Allow email-less member cards
-- Run in Supabase SQL Editor
--
-- The intended schema (supabase-schema.sql) declares customers.email as
-- NULLABLE so cards can be issued for members who have no email address
-- (phone is their identity). Some live databases were created from an
-- older schema where email is NOT NULL, which makes card issuing fail with:
--   null value in column "email" of relation "customers"
--      violates not-null constraint
--
-- This migration aligns the live database with the intended schema.
-- It is safe to re-run.
-- =========================================================

ALTER TABLE public.customers
  ALTER COLUMN email DROP NOT NULL;

-- =========================================================
-- MI ADVANTAGE - DATABASE MIGRATION v2
-- Run this ONCE in your Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> Paste -> Run)
-- It upgrades an existing database with: super admin roles, shop approval workflow,
-- email verification, contract & RDB certificate fields, and verification codes table.
-- =========================================================

-- 1. ADMINS: role (super_admin / admin), status, email_verified
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- 2. SHOPS: approval workflow + business documents + email verification
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS contract TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS rdb_certificate TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- 3. CUSTOMIZATION: login / signup form content fields
ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS login_heading TEXT DEFAULT 'Partner Shop Terminal';
ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS login_subtext TEXT DEFAULT 'Authorized Merchants Only';
ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS signup_heading TEXT DEFAULT 'Register Your Shop';
ALTER TABLE public.customization ADD COLUMN IF NOT EXISTS signup_subtext TEXT DEFAULT 'Submit your business details for admin approval';

-- 4. VERIFICATION CODES TABLE (email verification + password reset codes)
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

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select verification_codes" ON public.verification_codes FOR SELECT USING (true);
CREATE POLICY "Allow public insert verification_codes" ON public.verification_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update verification_codes" ON public.verification_codes FOR UPDATE USING (true);

-- 5. UPGRADE EXISTING DATA
-- Existing shops are trusted partners -> approved & verified
UPDATE public.shops SET status = 'approved', email_verified = true WHERE status = 'pending';

-- Existing admins become verified & active
UPDATE public.admins SET status = 'active', email_verified = true WHERE email_verified = false;

-- Make artdeje@mail.com the SUPER ADMIN
UPDATE public.admins SET role = 'super_admin', status = 'active', email_verified = true WHERE email = 'artdeje@mail.com';

-- If the super admin row does not exist yet, create it
INSERT INTO public.admins (id, name, email, password, role, status, email_verified)
VALUES ('admin-1', 'Super Administrator', 'artdeje@mail.com', 'admin123', 'super_admin', 'active', true)
ON CONFLICT (email) DO UPDATE SET role = 'super_admin', status = 'active', email_verified = true;

-- =========================================================
-- DONE. Now run: npm run db:init
-- =========================================================

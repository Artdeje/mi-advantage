-- =========================================================
-- BRANDING MIGRATION v2 — Run in Supabase SQL Editor
-- Adds full branding customization columns to existing DB
-- =========================================================

ALTER TABLE public.customization
    ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#059669',
    ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#0d9488',
    ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#f59e0b',
    ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#f8fafc',
    ADD COLUMN IF NOT EXISTS sidebar_color TEXT DEFAULT '#ffffff',
    ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT '#ffffff',
    ADD COLUMN IF NOT EXISTS text_primary_color TEXT DEFAULT '#1e293b',
    ADD COLUMN IF NOT EXISTS text_secondary_color TEXT DEFAULT '#64748b',
    ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'Inter',
    ADD COLUMN IF NOT EXISTS heading_font TEXT DEFAULT 'Space Grotesk',
    ADD COLUMN IF NOT EXISTS base_font_size TEXT DEFAULT '14px',
    ADD COLUMN IF NOT EXISTS login_background_type TEXT DEFAULT 'gradient',
    ADD COLUMN IF NOT EXISTS login_background_value TEXT DEFAULT 'linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%)',
    ADD COLUMN IF NOT EXISTS footer_text TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS footer_subtext TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS email_header_html TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS email_footer_html TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS custom_css TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Update existing row with default branding values
UPDATE public.customization SET
    primary_color = '#059669',
    secondary_color = '#0d9488',
    accent_color = '#f59e0b',
    background_color = '#f8fafc',
    sidebar_color = '#ffffff',
    card_color = '#ffffff',
    text_primary_color = '#1e293b',
    text_secondary_color = '#64748b',
    font_family = 'Inter',
    heading_font = 'Space Grotesk',
    base_font_size = '14px',
    login_background_type = 'gradient',
    login_background_value = 'linear-gradient(135deg, #f8fafc 0%, #ecfdf5 100%)',
    updated_at = now()
WHERE id = 'global-config';

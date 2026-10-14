-- v6 Migration: Editable platform subtitle ("Kigali Premium Privilege")
-- Adds customization.subtitle and backfills existing config rows.

ALTER TABLE public.customization
  ADD COLUMN IF NOT EXISTS subtitle TEXT DEFAULT 'Kigali Premium Privilege';

UPDATE public.customization
SET subtitle = 'Kigali Premium Privilege'
WHERE subtitle IS NULL OR subtitle = '';

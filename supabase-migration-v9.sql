-- =========================================================
-- MIGRATION v9 — Member card branding
-- Run in Supabase SQL Editor
--
-- Adds the card-specific branding fields so the printed/digital member
-- card can carry its own logo and short monogram (e.g. "BP") while the
-- rest of the portal keeps using the system logo.
--
-- Safe to re-run. The app degrades gracefully when the columns are
-- missing (it falls back to the system logo and derives the monogram
-- from the platform title).
-- =========================================================

ALTER TABLE public.customization
  ADD COLUMN IF NOT EXISTS card_brand TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS card_logo_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS card_wordmark TEXT DEFAULT '';

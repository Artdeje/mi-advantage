-- =========================================================
-- REFERRER CREDIT + RENEWAL STATUS MIGRATION v5
-- Run in Supabase SQL Editor
--
-- Adds to public.customers:
--   credit_status TEXT (pending/approved/paid) — referrer reward lifecycle
--
-- Also normalises card_status to the 'renew' vocabulary and re-flags any card
-- whose expiration date/time has been REACHED (date-only cards expire at the
-- start of the expiry day, so a card expiring today is already flagged).
-- =========================================================

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS credit_status TEXT DEFAULT 'pending';

-- Normalise credit statuses.
UPDATE public.customers
SET credit_status = 'pending'
WHERE credit_status IS NULL OR credit_status NOT IN ('pending', 'approved', 'paid');

-- Migrate legacy 'expired' statuses to 'renew'.
UPDATE public.customers
SET card_status = 'renew'
WHERE card_status IN ('expired');

-- Auto-flag cards whose expiry has been reached (app semantics).
UPDATE public.customers
SET card_status = 'renew'
WHERE card_status = 'active'
  AND valid_until IS NOT NULL
  AND (
    (valid_until::text LIKE '%T%' AND valid_until::timestamp <= now())
    OR (valid_until::text NOT LIKE '%T%'
        AND valid_until::date <= CURRENT_DATE)
  );

CREATE INDEX IF NOT EXISTS idx_customers_credit_status
    ON public.customers (credit_status);

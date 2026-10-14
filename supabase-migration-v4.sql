-- =========================================================
-- CUSTOMER PROFILE + REFERRER + CARD STATUS MIGRATION v4
-- Run in Supabase SQL Editor (includes v3 fields + new v4 fields)
--
-- Adds to public.customers:
--   customer_type  TEXT  (student/other)      [v3]
--   student_id     TEXT                       [v3]
--   university     TEXT                       [v3]
--   referee_number TEXT  (referrer CARD ID)   [v4]
--   card_status    TEXT  (active/expired/suspended) [v4]
-- =========================================================

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'other',
    ADD COLUMN IF NOT EXISTS student_id TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS university TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS referee_number TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS card_status TEXT DEFAULT 'active';

-- Backfill existing rows so nothing is null.
UPDATE public.customers
SET customer_type = 'other'
WHERE customer_type IS NULL OR customer_type = '';

UPDATE public.customers
SET referee_number = ''
WHERE referee_number IS NULL;

UPDATE public.customers
SET card_status = 'active'
WHERE card_status IS NULL OR card_status = '';

-- Normalise stored card status values ('renew' is the current status name,
-- 'expired' is the legacy alias).
UPDATE public.customers
SET card_status = 'renew'
WHERE card_status IN ('expired');

UPDATE public.customers
SET card_status = 'active'
WHERE card_status NOT IN ('active', 'renew', 'suspended');

-- Auto-flag any card whose expiry date/time has already been REACHED.
-- Matches app semantics: values with an exact time expire at that time;
-- date-only values expire at the START of the expiry day (the date reached).
UPDATE public.customers
SET card_status = 'renew'
WHERE card_status = 'active'
  AND valid_until IS NOT NULL
  AND (
    (valid_until::text LIKE '%T%' AND valid_until::timestamp <= now())
    OR (valid_until::text NOT LIKE '%T%'
        AND valid_until::date <= CURRENT_DATE)
  );

-- OPTIONAL: index for fast referrer lookups (qr_code / referee_number).
CREATE INDEX IF NOT EXISTS idx_customers_referee_number
    ON public.customers (referee_number);

CREATE INDEX IF NOT EXISTS idx_customers_card_status
    ON public.customers (card_status);

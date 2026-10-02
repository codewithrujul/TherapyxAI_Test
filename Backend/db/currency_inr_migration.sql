-- ═══════════════════════════════════════════════════════════════════════════
-- Currency: Indian Rupees (INR) everywhere
-- ═══════════════════════════════════════════════════════════════════════════
-- The product now prices everything in INR. The app already DISPLAYS rupees
-- regardless of what is stored, so this migration is about keeping the stored
-- currency code consistent with that. Run it once in the Supabase SQL editor.
--
-- NOTE: this only changes the currency CODE. It does NOT convert amounts.
-- A therapist rate of 120 stays 120 (now read as ₹120). If any existing rows
-- hold dollar-scale amounts (e.g. the dev seed therapists at 85–150), update
-- the amounts separately to real rupee prices.

-- 1) New rows default to INR
ALTER TABLE public.therapists   ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE public.appointments ALTER COLUMN currency SET DEFAULT 'INR';

-- 2) Relabel existing rows that were created with the old USD default
UPDATE public.therapists   SET currency = 'INR' WHERE currency IS DISTINCT FROM 'INR';
UPDATE public.appointments SET currency = 'INR' WHERE currency IS DISTINCT FROM 'INR';

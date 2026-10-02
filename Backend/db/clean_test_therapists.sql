-- =============================================================================
-- Cleanup Script: Delete 10 Verified Test Therapists & Associated Schedules
-- Database: PostgreSQL / Supabase
-- =============================================================================

BEGIN;

-- 1. Create a temporary table of the 10 test therapist IDs
CREATE TEMP TABLE temp_test_therapist_ids AS
SELECT id FROM public.therapists
WHERE email IN (
    'sarah.jenkins@example.com',
    'marcus.vance@example.com',
    'elena.rodriguez@example.com',
    'david.chen@example.com',
    'aisha.patel@example.com',
    'robert.sterling@example.com',
    'sophia.almansoor@example.com',
    'jonathan.hayes@example.com',
    'maya.lin@example.com',
    'benjamin.carter@example.com'
);

-- 2. Delete any test appointments booked with these 10 therapists
DELETE FROM public.appointments
WHERE therapist_id IN (SELECT id FROM temp_test_therapist_ids);

-- 3. Delete availability schedules for these 10 therapists
DELETE FROM public.therapist_availability
WHERE therapist_id IN (SELECT id FROM temp_test_therapist_ids);

-- 4. Delete time-off records for these 10 therapists (if any)
DELETE FROM public.therapist_time_off
WHERE therapist_id IN (SELECT id FROM temp_test_therapist_ids);

-- 5. Delete the 10 test therapist records
DELETE FROM public.therapists
WHERE id IN (SELECT id FROM temp_test_therapist_ids);

-- Clean up temp table
DROP TABLE temp_test_therapist_ids;

COMMIT;

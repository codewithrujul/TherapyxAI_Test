-- =============================================================================
-- Migration: Appointment Conflict & Overlap Enforcement Trigger
-- Database: PostgreSQL / Supabase
-- Description: Prevents double-booking a therapist for the same time slot
--              and prevents a patient/user from having overlapping appointments.
-- Active Statuses: 'pending', 'confirmed', 'completed'
-- Released Status: 'cancelled'
-- =============================================================================

CREATE OR REPLACE FUNCTION check_appointment_conflicts()
RETURNS TRIGGER AS $$
BEGIN
    -- Only check active appointment statuses
    IF NEW.status IN ('pending', 'confirmed', 'completed') THEN
        
        -- 1. Check therapist conflict (Therapist already has an active appointment in overlapping time window)
        IF EXISTS (
            SELECT 1 FROM public.appointments
            WHERE therapist_id = NEW.therapist_id
              AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
              AND status IN ('pending', 'confirmed', 'completed')
              AND start_time < NEW.end_time
              AND end_time > NEW.start_time
        ) THEN
            RAISE EXCEPTION 'This time slot is no longer available for this therapist.'
                USING ERRCODE = '23505', HINT = 'SLOT_UNAVAILABLE';
        END IF;

        -- 2. Check user overlap conflict (User already has an active appointment in overlapping time window)
        IF EXISTS (
            SELECT 1 FROM public.appointments
            WHERE user_id = NEW.user_id
              AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
              AND status IN ('pending', 'confirmed', 'completed')
              AND start_time < NEW.end_time
              AND end_time > NEW.start_time
        ) THEN
            RAISE EXCEPTION 'You already have another appointment scheduled during this time slot.'
                USING ERRCODE = '23505', HINT = 'USER_OVERLAP_CONFLICT';
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to public.appointments table
DROP TRIGGER IF EXISTS trg_check_appointment_conflicts ON public.appointments;
CREATE TRIGGER trg_check_appointment_conflicts
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION check_appointment_conflicts();

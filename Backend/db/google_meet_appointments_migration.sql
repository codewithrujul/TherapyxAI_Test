-- =============================================================================
-- Migration: Add Google Meet Integration Columns to Appointments Table
-- Database: PostgreSQL / Supabase
-- Description: Adds google_meet_space_id, google_meet_url, google_meet_created_at,
--              and google_meet_status columns to public.appointments table.
-- =============================================================================

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS google_meet_space_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_meet_url TEXT,
ADD COLUMN IF NOT EXISTS google_meet_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_meet_status VARCHAR(30) DEFAULT 'pending';

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_appointments_google_meet_status ON public.appointments(google_meet_status);

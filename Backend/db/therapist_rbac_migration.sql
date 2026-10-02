-- =============================================================================
-- Migration: Add Role-Based Access Control (RBAC) for Therapists & Admin
-- Database: PostgreSQL / Supabase
-- Description: Adds role column to public.profiles and index on user_id in therapists
-- =============================================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'patient';

-- Ensure constraint for allowed roles
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_role_check CHECK (role IN ('patient', 'therapist', 'admin'));
    END IF;
END $$;

-- Indexes for role queries & user-therapist lookup
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_therapists_user_id ON public.therapists(user_id);

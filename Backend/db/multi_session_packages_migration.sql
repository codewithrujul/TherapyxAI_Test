-- =============================================================================
-- Migration: Therapy Booking Packages & Multi-Session Support
-- Database: PostgreSQL / Supabase
-- Description: Schema for therapy booking packages (1, 3, 6, 9 sessions),
--              links appointments to parent package, tracks completion status.
-- =============================================================================

-- 1. Create therapy_booking_packages table
CREATE TABLE IF NOT EXISTS public.therapy_booking_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    total_sessions INTEGER NOT NULL CHECK (total_sessions IN (1, 3, 6, 9)),
    completed_sessions INTEGER NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
    remaining_sessions INTEGER NOT NULL CHECK (remaining_sessions >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add package_id and session_number columns to public.appointments
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.therapy_booking_packages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS session_number INTEGER DEFAULT 1 CHECK (session_number >= 1);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_package_id ON public.appointments(package_id);
CREATE INDEX IF NOT EXISTS idx_packages_user_id ON public.therapy_booking_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_packages_therapist_id ON public.therapy_booking_packages(therapist_id);

-- 4. Automatic updated_at trigger for therapy_booking_packages
DROP TRIGGER IF EXISTS trg_packages_updated_at ON public.therapy_booking_packages;
CREATE TRIGGER trg_packages_updated_at
BEFORE UPDATE ON public.therapy_booking_packages
FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

-- 5. Row Level Security (RLS) policies
ALTER TABLE public.therapy_booking_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and therapists can view own packages" ON public.therapy_booking_packages;
CREATE POLICY "Users and therapists can view own packages"
ON public.therapy_booking_packages FOR SELECT
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.therapists t WHERE t.id = therapy_booking_packages.therapist_id AND t.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Users can insert own packages" ON public.therapy_booking_packages;
CREATE POLICY "Users can insert own packages"
ON public.therapy_booking_packages FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and therapists can update own packages" ON public.therapy_booking_packages;
CREATE POLICY "Users and therapists can update own packages"
ON public.therapy_booking_packages FOR UPDATE
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.therapists t WHERE t.id = therapy_booking_packages.therapist_id AND t.user_id = auth.uid()
));

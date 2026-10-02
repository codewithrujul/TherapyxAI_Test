-- =============================================================================
-- Migration: Therapist Onboarding Requests & In-App Notifications
-- Database: PostgreSQL / Supabase
-- =============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. THERAPIST ONBOARDING REQUESTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.therapist_onboarding_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'onboarding', 'approved', 'rejected')),
    form_data JSONB DEFAULT '{}'::jsonb,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add column if table already exists
ALTER TABLE public.therapist_onboarding_requests 
ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb;

-- Partial Unique Index to ensure a user cannot have multiple active (pending or onboarding) requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_therapist_request 
ON public.therapist_onboarding_requests (user_id) 
WHERE status IN ('pending', 'onboarding');

-- Indexes for status & lookup performance
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_status ON public.therapist_onboarding_requests(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_user ON public.therapist_onboarding_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_requested_at ON public.therapist_onboarding_requests(requested_at DESC);


-- -----------------------------------------------------------------------------
-- 2. NOTIFICATIONS TABLE (IN-APP NOTIFICATIONS ENGINE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL for target_role notifications
    target_role VARCHAR(20) DEFAULT 'user' CHECK (target_role IN ('admin', 'therapist', 'patient', 'user', 'all')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notification lookup
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON public.notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);


-- -----------------------------------------------------------------------------
-- 3. AUTOMATIC UPDATED_AT TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_onboarding_requests_updated_at ON public.therapist_onboarding_requests;
CREATE TRIGGER trg_onboarding_requests_updated_at
BEFORE UPDATE ON public.therapist_onboarding_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();


-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES (Supabase)
-- -----------------------------------------------------------------------------
ALTER TABLE public.therapist_onboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Onboarding Requests Policies
DROP POLICY IF EXISTS "Users view own onboarding requests" ON public.therapist_onboarding_requests;
CREATE POLICY "Users view own onboarding requests"
ON public.therapist_onboarding_requests FOR SELECT
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "Users insert own onboarding requests" ON public.therapist_onboarding_requests;
CREATE POLICY "Users insert own onboarding requests"
ON public.therapist_onboarding_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage onboarding requests" ON public.therapist_onboarding_requests;
CREATE POLICY "Admins manage onboarding requests"
ON public.therapist_onboarding_requests FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
));

-- Notifications Policies
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT
USING (
    auth.uid() = user_id OR 
    target_role = 'all' OR
    EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = target_role OR role = 'admin')
    )
);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

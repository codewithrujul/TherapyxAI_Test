-- =============================================================================
-- Migration: Therapist Profile & Appointment Booking System Setup
-- Database: PostgreSQL / Supabase
-- Description: Schema for therapist profiles, recurring availability, time-off,
--              appointment booking, clinical notes, and reviews with RLS.
-- =============================================================================

-- Enable extension for UUID generation if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE therapist_status_enum AS ENUM ('pending_verification', 'active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE appointment_status_enum AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE session_type_enum AS ENUM ('video', 'audio', 'chat', 'in_person');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM ('pending', 'paid', 'refunded', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- -----------------------------------------------------------------------------
-- 2. THERAPISTS TABLE (Includes Onboarding Form & Profile Settings)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.therapists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Optional link to auth user account
    
    -- Step 1: Personal & Contact Details
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    gender VARCHAR(30), -- 'Male', 'Female', 'Non-binary', 'Prefer not to say'
    dob DATE, -- Date of Birth
    profile_picture_url TEXT,
    address_city VARCHAR(100),
    address_country VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Step 2: Professional Qualifications & Credential Verification
    title VARCHAR(150) NOT NULL, -- e.g. 'Licensed Clinical Psychologist', 'LMFT', 'LCSW'
    short_headline VARCHAR(255), -- Catchy summary headline e.g. "Empathetic CBT specialist for Anxiety & Burnout"
    highest_degree VARCHAR(100), -- e.g. 'Ph.D in Clinical Psychology', 'M.S. in Counseling'
    university_institution VARCHAR(200),
    license_number VARCHAR(100),
    licensing_state_board VARCHAR(150), -- e.g. 'California Board of Behavioral Sciences'
    license_expiry_date DATE,
    years_of_experience INTEGER DEFAULT 0 CHECK (years_of_experience >= 0),
    license_document_url TEXT, -- Uploaded verification document URL
    gov_id_document_url TEXT, -- Uploaded ID document URL

    -- Step 3: Practice, Modalities & Specialties
    bio TEXT, -- Detailed professional biography
    therapeutic_approaches TEXT[] DEFAULT ARRAY[]::TEXT[], -- e.g. ['CBT', 'DBT', 'EMDR', 'Psychodynamic', 'Humanistic']
    specialties TEXT[] DEFAULT ARRAY[]::TEXT[], -- e.g. ['Anxiety', 'Depression', 'Trauma/PTSD', 'Couples Therapy']
    target_clients TEXT[] DEFAULT ARRAY[]::TEXT[], -- e.g. ['Adults', 'Teens', 'Couples', 'LGBTQ+']
    languages TEXT[] DEFAULT ARRAY['English'], -- e.g. ['English', 'Spanish', 'French']

    -- Step 4: Pricing & Session Preferences
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (hourly_rate >= 0),
    currency VARCHAR(10) DEFAULT 'USD',
    supported_session_types session_type_enum[] DEFAULT ARRAY['video'::session_type_enum], -- e.g. ['video', 'audio', 'chat']

    -- Step 5: Payout & Bank Info (Optional)
    payout_bank_name VARCHAR(150),
    payout_account_number VARCHAR(100),
    payout_routing_code VARCHAR(50),

    -- Onboarding Progress & Admin Verification Status
    onboarding_step INTEGER DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 5),
    onboarding_completed BOOLEAN DEFAULT false,
    verification_status VARCHAR(30) DEFAULT 'pending_review' CHECK (verification_status IN ('draft', 'pending_review', 'approved', 'rejected')),
    rejection_reason TEXT, -- Admin feedback if verification fails

    -- System & Stats
    rating NUMERIC(3, 2) DEFAULT 5.00 CHECK (rating BETWEEN 1.00 AND 5.00),
    total_reviews INTEGER DEFAULT 0 CHECK (total_reviews >= 0),
    is_verified BOOLEAN DEFAULT false,
    status therapist_status_enum DEFAULT 'pending_verification',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- 3. THERAPIST AVAILABILITY (WEEKLY RECURRING SCHEDULE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.therapist_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday, ..., 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration_minutes INTEGER DEFAULT 50 CHECK (slot_duration_minutes > 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_time_order CHECK (end_time > start_time),
    CONSTRAINT uq_therapist_day_start UNIQUE (therapist_id, day_of_week, start_time)
);


-- -----------------------------------------------------------------------------
-- 4. THERAPIST UN-AVAILABILITY / TIME-OFF OVERRIDES (Vacations, Leave, Holidays)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.therapist_time_off (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_time_off_range CHECK (end_datetime > start_datetime)
);


-- -----------------------------------------------------------------------------
-- 5. APPOINTMENTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_number VARCHAR(50) NOT NULL UNIQUE DEFAULT ('APT-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8))),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    session_type session_type_enum DEFAULT 'video',
    status appointment_status_enum DEFAULT 'pending',
    user_notes TEXT, -- Notes/reason submitted by user when booking
    clinical_notes TEXT, -- Private clinical notes written by therapist post-session
    meeting_link TEXT, -- Dynamic video consultation link (e.g., Daily.co / Jitsi / WebRTC room)
    fee_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (fee_amount >= 0),
    currency VARCHAR(10) DEFAULT 'USD',
    payment_status payment_status_enum DEFAULT 'pending',
    payment_reference VARCHAR(255),
    cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('user', 'therapist', 'system')),
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_appointment_time CHECK (end_time > start_time)
);


-- -----------------------------------------------------------------------------
-- 6. THERAPIST REVIEWS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.therapist_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- 7. INDEXES FOR PERFORMANCE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_therapists_status ON public.therapists(status);
CREATE INDEX IF NOT EXISTS idx_therapists_rating ON public.therapists(rating DESC);
CREATE INDEX IF NOT EXISTS idx_therapists_specialties ON public.therapists USING GIN(specialties);
CREATE INDEX IF NOT EXISTS idx_therapists_languages ON public.therapists USING GIN(languages);

CREATE INDEX IF NOT EXISTS idx_availability_therapist ON public.therapist_availability(therapist_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_time_off_therapist ON public.therapist_time_off(therapist_id, start_datetime, end_datetime);

CREATE INDEX IF NOT EXISTS idx_appointments_user ON public.appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_therapist ON public.appointments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON public.appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_therapist_time ON public.appointments(therapist_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_reviews_therapist ON public.therapist_reviews(therapist_id);


-- -----------------------------------------------------------------------------
-- 8. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_therapists_updated_at ON public.therapists;
CREATE TRIGGER trg_therapists_updated_at
BEFORE UPDATE ON public.therapists
FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();


-- -----------------------------------------------------------------------------
-- 9. RECALCULATE THERAPIST RATING TRIGGER FUNCTION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_therapist_rating_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_therapist_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_therapist_id := OLD.therapist_id;
    ELSE
        target_therapist_id := NEW.therapist_id;
    END IF;

    UPDATE public.therapists
    SET 
        rating = COALESCE((
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM public.therapist_reviews
            WHERE therapist_id = target_therapist_id
        ), 5.00),
        total_reviews = (
            SELECT COUNT(*)
            FROM public.therapist_reviews
            WHERE therapist_id = target_therapist_id
        )
    WHERE id = target_therapist_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_therapist_rating ON public.therapist_reviews;
CREATE TRIGGER trg_update_therapist_rating
AFTER INSERT OR UPDATE OR DELETE ON public.therapist_reviews
FOR EACH ROW EXECUTE FUNCTION update_therapist_rating_stats();


-- -----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES (Supabase)
-- -----------------------------------------------------------------------------
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_reviews ENABLE ROW LEVEL SECURITY;

-- Therapists: Public read active therapists OR therapists viewing their own record
DROP POLICY IF EXISTS "Public read active therapists" ON public.therapists;
CREATE POLICY "Public read active therapists or self"
ON public.therapists FOR SELECT
USING (status = 'active' OR auth.uid() = user_id);

-- Therapists: Allow signed-in users/therapists to create their initial profile during onboarding
DROP POLICY IF EXISTS "Therapists create own profile" ON public.therapists;
CREATE POLICY "Therapists create own profile"
ON public.therapists FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Therapists: Allow therapists to update their own onboarding profile data
DROP POLICY IF EXISTS "Therapists update own profile" ON public.therapists;
CREATE POLICY "Therapists update own profile"
ON public.therapists FOR UPDATE
USING (auth.uid() = user_id);

-- Therapist Availability: Public read
CREATE POLICY "Public read therapist availability"
ON public.therapist_availability FOR SELECT
USING (true);

-- Therapist Time Off: Public read
CREATE POLICY "Public read therapist time off"
ON public.therapist_time_off FOR SELECT
USING (true);

-- Appointments: Users can read their own appointments
CREATE POLICY "Users can view own appointments"
ON public.appointments FOR SELECT
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.therapists t WHERE t.id = appointments.therapist_id AND t.user_id = auth.uid()
));

-- Appointments: Users can create appointments for themselves
CREATE POLICY "Users can insert own appointments"
ON public.appointments FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Appointments: Users/Therapists can update their own appointments
CREATE POLICY "Users and therapists can update own appointments"
ON public.appointments FOR UPDATE
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.therapists t WHERE t.id = appointments.therapist_id AND t.user_id = auth.uid()
));

-- Reviews: Public read
CREATE POLICY "Public read reviews"
ON public.therapist_reviews FOR SELECT
USING (true);

-- Reviews: User can insert review for completed appointment
CREATE POLICY "Users can insert review for own completed appointment"
ON public.therapist_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

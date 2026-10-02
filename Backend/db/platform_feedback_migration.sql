-- Migration for storing platform feedback
CREATE TABLE IF NOT EXISTS public.platform_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    guest_name VARCHAR(100),
    voice_quality VARCHAR(100),
    model_accuracy VARCHAR(100),
    modal_support VARCHAR(100),
    therapist_integration VARCHAR(100),
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

import dotenv from "dotenv";
dotenv.config();

import { supabaseAdmin } from "../db/supabaseClient";

async function applyPackageMigration() {
    console.log("[Migration] Applying multi-session packages migration to Supabase Database...");

    const sql = `
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

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.therapy_booking_packages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS session_number INTEGER DEFAULT 1 CHECK (session_number >= 1);

CREATE INDEX IF NOT EXISTS idx_appointments_package_id ON public.appointments(package_id);
CREATE INDEX IF NOT EXISTS idx_packages_user_id ON public.therapy_booking_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_packages_therapist_id ON public.therapy_booking_packages(therapist_id);
`;

    try {
        const { data, error } = await supabaseAdmin.rpc("exec_sql" as any, { sql_query: sql });
        if (error) {
            console.warn("[Migration] exec_sql RPC notice:", error.message);
        } else {
            console.log("[Migration] Multi-session packages migration applied successfully!");
        }
    } catch (err: any) {
        console.error("[Migration] Error applying package migration:", err?.message || err);
    }
}

applyPackageMigration();

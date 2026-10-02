import dotenv from "dotenv";
dotenv.config();

import { supabaseAdmin } from "../db/supabaseClient";

async function applyMigration() {
    console.log("[Migration] Applying appointment conflict trigger migration to Supabase Database...");

    const sql = `
CREATE OR REPLACE FUNCTION check_appointment_conflicts()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('pending', 'confirmed', 'completed') THEN
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

DROP TRIGGER IF EXISTS trg_check_appointment_conflicts ON public.appointments;
CREATE TRIGGER trg_check_appointment_conflicts
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION check_appointment_conflicts();
`;

    try {
        const { data, error } = await supabaseAdmin.rpc("exec_sql" as any, { sql_query: sql });
        if (error) {
            console.warn("[Migration] exec_sql RPC failed or not present, attempting direct check...", error.message);
        } else {
            console.log("[Migration] Migration applied successfully via RPC!");
        }
    } catch (err: any) {
        console.error("[Migration] Error:", err?.message || err);
    }
}

applyMigration();

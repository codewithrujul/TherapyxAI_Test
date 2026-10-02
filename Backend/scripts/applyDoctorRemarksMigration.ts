import "./_env";
import { supabaseAdmin } from "../db/supabaseClient";

async function applyDoctorRemarksMigration() {
    console.log("[Migration] Applying doctor remarks, suggestions & treatment status migration to Supabase DB...");

    const sql = `
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS doctor_remarks TEXT,
ADD COLUMN IF NOT EXISTS doctor_suggestions TEXT,
ADD COLUMN IF NOT EXISTS doctor_prescription TEXT,
ADD COLUMN IF NOT EXISTS treatment_status VARCHAR(50) DEFAULT 'active';

ALTER TABLE public.therapy_booking_packages
ADD COLUMN IF NOT EXISTS treatment_status VARCHAR(50) DEFAULT 'active';
`;

    try {
        const { data, error } = await supabaseAdmin.rpc("exec_sql" as any, { sql_query: sql });
        if (error) {
            console.warn("[Migration] exec_sql RPC notice:", error.message);
        } else {
            console.log("[Migration] Doctor remarks and treatment status migration applied successfully!");
        }
    } catch (err: any) {
        console.error("[Migration] Error applying migration:", err?.message || err);
    }
}

applyDoctorRemarksMigration();

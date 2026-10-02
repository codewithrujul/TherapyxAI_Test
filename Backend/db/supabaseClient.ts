import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL      = process.env.SUPABASE_DATABASE_URL      ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "[Supabase] SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables"
  );
}

/**
 * Singleton Supabase client shared across the app.
 * Import this wherever you need DB / Auth access.
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession:   false,   // server-side — no local storage
    detectSessionInUrl: false,
  },
});

/**
 * Admin client — uses service role key, bypasses RLS.
 * ONLY use server-side, never expose to the browser.
 */
export const supabaseAdmin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,   // ← service role, not anon
    {
        auth: {
            autoRefreshToken:    false,
            persistSession:      false,
        },
    }
);
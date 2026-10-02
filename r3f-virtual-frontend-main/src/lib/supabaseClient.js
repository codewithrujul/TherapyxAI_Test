import { createClient } from '@supabase/supabase-js';

// Capture the auth hash synchronously at module load — Supabase's detectSessionInUrl
// strips the hash from the URL before onAuthStateChange fires, so we grab it here first.
// This tells us a SIGNED_IN event came from our custom backend Google OAuth (magic link).
export const initialAuthHash = typeof window !== 'undefined' ? window.location.hash : '';
export const isMagicLinkRedirect = initialAuthHash.includes('type=magiclink');

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: true,   // picks up Google OAuth redirect automatically
  },
});

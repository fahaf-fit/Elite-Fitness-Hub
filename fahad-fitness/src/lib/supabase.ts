import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and anon key must be set in environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:    true,   // always write session to localStorage
    autoRefreshToken:  true,   // silently refresh before expiry
    detectSessionInUrl: true,  // pick up access_token from URL hash (email links)
    storageKey: "fahad-fitness-auth-v1", // fixed key — not tied to the current domain
  },
});

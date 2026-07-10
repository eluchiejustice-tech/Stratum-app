import { createClient } from "@supabase/supabase-js";

// These read from environment variables so the real keys never get
// committed to the repo. Set them in Vercel's project settings as
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before this is wired in.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

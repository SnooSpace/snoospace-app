import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] Missing environment variables. Realtime will not function.");
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const setSupabaseAuth = (expressJwt) => {
  if (supabase && expressJwt) {
    console.log("[Supabase Auth] Bridging Express JWT to Supabase Realtime client.");
    supabase.realtime.setAuth(expressJwt);
  }
};

export const clearSupabaseAuth = () => {
  if (supabase) {
    console.log("[Supabase Auth] Clearing Express JWT from Supabase Realtime client.");
    supabase.realtime.setAuth(null);
  }
};

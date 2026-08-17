import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * The one Supabase client for the app.
 *
 * Only the URL and the anon key ever reach the browser (brief §3, rule 10).
 * The anon key is publishable by design — RLS is what actually protects the
 * data, which is why the schema enables it on every table and makes the
 * privilege columns physically ungrantable to `authenticated`.
 *
 * The service-role key exists only inside Edge Functions and must never be
 * imported here.
 *
 * Note the deliberate absence of the old scaffold's `localStorage` credential
 * fallback: letting a page set its own backend URL at runtime is a redirection
 * vector, not a feature.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly at startup rather than producing confusing 401s later.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in.',
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'sonol-auth',
  },
});

/** Row/insert/update helpers so call sites never reach into the generated tree. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

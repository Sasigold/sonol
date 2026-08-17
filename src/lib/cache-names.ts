/**
 * Shared between the service-worker config (`vite.config.ts`) and the sign-out
 * purge (`AuthProvider`). Its own file, with no imports, so the build config can
 * read it without pulling browser code into Node.
 *
 * The Supabase responses get their own named bucket precisely so they can be
 * deleted wholesale when a user signs out — see `purgeUserData`.
 */
export const SUPABASE_CACHE_NAME = 'sonol-supabase-rest';

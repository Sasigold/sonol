import { createContext, use } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Tables } from '@/lib/supabase';

/**
 * Only the columns the client is allowed to read and actually needs.
 *
 * `photo_url` and `phone_number` joined the list when the profile screen
 * arrived: they are the two columns — alongside `display_name` — that the
 * grants let a user write on their own row.
 */
export type Profile = Pick<
  Tables<'profiles'>,
  | 'id'
  | 'email'
  | 'display_name'
  | 'photo_url'
  | 'phone_number'
  | 'is_admin'
  | 'is_authorized'
  | 'completed_count'
>;

/**
 * A discriminated union, not a bag of booleans.
 *
 * The distinction that matters is `loading` vs `signedOut`. With
 * `{ user: null, isLoading: true }` it is far too easy for a guard to read
 * `!user` and redirect to /signin on first paint — before the session has been
 * restored from storage — so every refresh flashes the login screen at a user
 * who is already signed in. Making "we do not know yet" its own case means a
 * guard cannot skip it: TypeScript forces the branch.
 *
 * `error` exists because a session can be valid while the profile fetch fails.
 * We must not guess `is_admin` in that situation — the screen shows a retry.
 */
export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'error'; message: string }
  | { status: 'signedIn'; session: Session; profile: Profile };

export interface AuthContextValue {
  state: AuthState;
  /** Ends the session for real, then the guards do the redirecting. */
  signOut: () => Promise<void>;
  /** Re-runs the profile fetch — used by the error state's retry. */
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (value === null) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}

/**
 * Mirrors the SQL helper `public.is_authorized()`, which is
 * `is_authorized OR is_admin`.
 *
 * Checking only `is_authorized` would lock an admin out of the UI that the
 * server would happily admit — the client would be stricter than the database,
 * which is the wrong direction for a guard to be wrong in.
 */
export function isAuthorized(profile: Profile): boolean {
  return profile.is_authorized || profile.is_admin;
}

import { z } from 'zod';
import type { Session } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY } from '@/lib/supabase';
import type { Profile } from '@/contexts/auth-context';

/**
 * What lets a signed-in worker stay signed in through a dead spot.
 *
 * The access token lives an hour. A worker who opens the app after a break —
 * every morning, after every stop longer than that — starts with an expired
 * token, and supabase-js has to refresh it before it will hand the session
 * back. On a weak signal that refresh fails, and `getSession()` answers
 * `session: null` **while the session is still in storage and still valid on
 * the server**. Taking that `null` at its word sent the worker to the sign-in
 * screen; they signed in again, and the database shows exactly that pattern:
 * a new session opened minutes after the old one's token expired, with the old
 * one never refreshed and never revoked.
 *
 * The session in storage and the last profile the server returned are enough
 * to keep working — the offline queue holds the taps — until supabase-js's own
 * ticker gets a refresh through and the provider picks up `TOKEN_REFRESHED`.
 */

const PROFILE_CACHE_KEY = 'sonol-profile';

/**
 * Only the columns `Profile` has. zod strips anything else, so a row cached by
 * an older build cannot smuggle a stale extra field into state.
 */
const cachedProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  display_name: z.string(),
  photo_url: z.string().nullable(),
  phone_number: z.string().nullable(),
  is_admin: z.boolean(),
  is_authorized: z.boolean(),
  completed_count: z.number(),
}) satisfies z.ZodType<Profile>;

/**
 * The fields of a stored session this app relies on. supabase-js wrote the
 * value, but storage is user-editable and survives across builds, so the shape
 * is checked rather than trusted.
 */
const storedSessionSchema = z.looseObject({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_at: z.number(),
  user: z.looseObject({ id: z.string().min(1) }),
});

function isStoredSession(value: unknown): value is Session {
  return storedSessionSchema.safeParse(value).success;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    // Private mode, quota, or a corrupt value — all mean "nothing usable".
    return null;
  }
}

/**
 * The session supabase-js has persisted, read directly — without the refresh
 * `getSession()` insists on when the access token is expired.
 *
 * Only ever used after supabase-js has failed to refresh for a NETWORK reason.
 * A definitive rejection (revoked or reused refresh token) makes supabase-js
 * remove the session itself, so this then returns `null` and the user really
 * is signed out.
 */
export function readStoredSession(): Session | null {
  const value = readJson(AUTH_STORAGE_KEY);
  return isStoredSession(value) ? value : null;
}

/** The last profile the server returned for this user, or `null`. */
export function readCachedProfile(userId: string): Profile | null {
  const parsed = cachedProfileSchema.safeParse(readJson(PROFILE_CACHE_KEY));
  return parsed.success && parsed.data.id === userId ? parsed.data : null;
}

export function writeCachedProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    /* best-effort: without it the next offline start shows the retry screen */
  }
}

export function clearCachedProfile(): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

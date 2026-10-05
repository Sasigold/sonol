import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toHebrewError } from '@/lib/errors';
import { offlineQueue } from '@/lib/offline-queue';
import { SUPABASE_CACHE_NAME } from '@/lib/cache-names';
import { AuthContext, type AuthState, type Profile } from './auth-context';
import {
  clearCachedProfile,
  readCachedProfile,
  readStoredSession,
  writeCachedProfile,
} from '@/lib/session-cache';

const PROFILE_COLUMNS =
  'id, email, display_name, photo_url, phone_number, is_admin, is_authorized, completed_count';

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();

  // `.single()` types `data` as the row whenever `error` is null, so no
  // non-null assertion is needed — and none is permitted (ESLint).
  if (error) throw error;
  return data;
}

/**
 * Everything belonging to the signed-in user that outlives the session.
 *
 * Two devices' worth of reasoning, both about a tablet shared between workers:
 *
 * 1. A queued station toggle is credited to whoever is signed in when it
 *    replays. Left in place it would put one worker's round on the next one's
 *    counter.
 * 2. The service worker's REST cache keys on the URL and ignores the
 *    `Authorization` header, so the same `/rest/v1/...` request made by the
 *    next user can be answered from the previous user's cached rows. RLS
 *    cannot help — the response never reaches the server.
 *
 * 3. The cached profile (see `session-cache.ts`) would let the next user's
 *    offline start render as the previous one.
 *
 * Best-effort by design: a failure here must not trap someone in a session
 * they asked to leave.
 */
async function purgeUserData(): Promise<void> {
  clearCachedProfile();
  try {
    await offlineQueue.clear();
  } catch {
    /* ignore */
  }
  try {
    if (typeof caches !== 'undefined') await caches.delete(SUPABASE_CACHE_NAME);
  } catch {
    /* ignore */
  }
}

/**
 * Open straight onto the stored session and the last profile, without waiting
 * for `getSession()`: when the token has expired it refreshes first, and on a
 * dead connection supabase-js retries with backoff for up to ~30 s before
 * giving up — half a minute of skeleton at the roadside. The mount effect still
 * decides; if the server has really ended the session, it lands on signedOut a
 * moment later.
 */
function initialState(): AuthState {
  const stored = readStoredSession();
  const cached = stored ? readCachedProfile(stored.user.id) : null;
  return stored && cached
    ? { status: 'signedIn', session: stored, profile: cached }
    : { status: 'loading' };
}

/**
 * Session + profile for the whole app, fetched once after sign-in and refetched
 * on every auth state change (brief §7).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);

  // Guards against a stale response overwriting a newer one: sign-out arriving
  // while a profile fetch for the previous session is still in flight would
  // otherwise resurrect that session in state.
  const requestId = useRef(0);

  const applySession = useCallback(async (session: Session | null): Promise<void> => {
    const id = ++requestId.current;

    if (!session) {
      if (id === requestId.current) setState({ status: 'signedOut' });
      return;
    }

    // The last profile the server returned for this user. Shown at once, so a
    // token refresh or a return from Waze never blanks the screen, and so a
    // start in a dead spot still opens the app.
    const cached = readCachedProfile(session.user.id);
    if (cached) setState({ status: 'signedIn', session, profile: cached });

    try {
      const profile = await fetchProfile(session.user.id);
      // Only a current answer is cached: one that lands after a sign-out would
      // otherwise write the departed user's profile back onto a shared device.
      if (id !== requestId.current) return;
      writeCachedProfile(profile);
      setState({ status: 'signedIn', session, profile });
    } catch (error) {
      // A valid session whose profile could not be read. Do NOT fall back to
      // "not an admin" — that would silently downgrade a real admin on a flaky
      // connection. With a cached profile, keep it: it is the server's own last
      // answer, not a guess, and the next auth event fetches again. Without one
      // there is nothing to show; surface the error and let the user retry.
      if (id === requestId.current && !cached) {
        setState({ status: 'error', message: toHebrewError(error) });
      }
    }
  }, []);

  /**
   * The session to start from, never `null` merely because the network is bad.
   *
   * `getSession()` refreshes an expired access token before answering, and a
   * refresh that cannot reach the server comes back as `session: null` plus a
   * network error — while the session itself is still in storage, untouched.
   * A rejection the server MEANT (revoked or reused refresh token) makes
   * supabase-js delete the stored session itself, so falling back to storage
   * cannot resurrect a session that is really over.
   */
  const loadSession = useCallback(async (): Promise<Session | null> => {
    const { data, error } = await supabase.auth.getSession();
    if (data.session) return data.session;
    return error ? readStoredSession() : null;
  }, []);

  useEffect(() => {
    const active = { current: true };

    void (async () => {
      const session = await loadSession();
      if (active.current) await applySession(session);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION repeats the getSession() above, and on a dead
      // connection it reports `null` for a session that is still perfectly
      // good — which is exactly what used to sign workers out. `loadSession`
      // answers that question properly; everything after it is a real change.
      if (event === 'INITIAL_SESSION') return;

      // supabase-js documents a deadlock if another Supabase call is awaited
      // directly inside this callback — it holds an internal lock while the
      // handler runs. Defer to a fresh task so the lock is released first.
      setTimeout(() => {
        if (active.current) void applySession(session);
      }, 0);
    });

    return () => {
      active.current = false;
      subscription.subscription.unsubscribe();
    };
  }, [applySession, loadSession]);

  const signOut = useCallback(async (): Promise<void> => {
    // Optimistic: flip to signedOut immediately so the guards redirect even if
    // the network call is slow. Defect 5 of the original app was a "logout"
    // that navigated without ending the session — this ends it for real.
    ++requestId.current;
    setState({ status: 'signedOut' });
    await purgeUserData();
    // `local`: end THIS device's session. The default, `global`, revokes every
    // session the user has, so a worker signing out of a shared tablet would
    // also be thrown out of the app on their own phone.
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setState({ status: 'loading' });
    await applySession(await loadSession());
  }, [applySession, loadSession]);

  const value = useMemo(() => ({ state, signOut, refresh }), [state, signOut, refresh]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

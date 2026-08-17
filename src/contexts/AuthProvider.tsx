import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toHebrewError } from '@/lib/errors';
import { AuthContext, type AuthState, type Profile } from './auth-context';

const PROFILE_COLUMNS = 'id, email, display_name, is_admin, is_authorized, completed_count';

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
 * Session + profile for the whole app, fetched once after sign-in and refetched
 * on every auth state change (brief §7).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

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

    try {
      const profile = await fetchProfile(session.user.id);
      if (id === requestId.current) setState({ status: 'signedIn', session, profile });
    } catch (error) {
      // A valid session whose profile could not be read. Do NOT fall back to
      // "not an admin" — that would silently downgrade a real admin on a flaky
      // connection. Surface it and let the user retry.
      if (id === requestId.current) {
        setState({ status: 'error', message: toHebrewError(error) });
      }
    }
  }, []);

  useEffect(() => {
    const active = { current: true };

    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active.current) return;
      if (error) {
        setState({ status: 'error', message: toHebrewError(error) });
        return;
      }
      await applySession(data.session);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
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
  }, [applySession]);

  const signOut = useCallback(async (): Promise<void> => {
    // Optimistic: flip to signedOut immediately so the guards redirect even if
    // the network call is slow. Defect 5 of the original app was a "logout"
    // that navigated without ending the session — this ends it for real.
    ++requestId.current;
    setState({ status: 'signedOut' });
    await supabase.auth.signOut();
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setState({ status: 'loading' });
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
  }, [applySession]);

  const value = useMemo(() => ({ state, signOut, refresh }), [state, signOut, refresh]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

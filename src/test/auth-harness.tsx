import type { ReactNode } from 'react';
import { AuthContext, type AuthState, type Profile } from '@/contexts/auth-context';

/** A profile with sensible defaults; override only what the test cares about. */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'worker@sonol.test',
    display_name: 'עובד בדיקה',
    photo_url: null,
    phone_number: null,
    is_admin: false,
    is_authorized: true,
    completed_count: 0,
    ...overrides,
  };
}

/**
 * Injects an arbitrary AuthState without going near Supabase, so guard tests
 * assert on the state machine rather than on network mocking.
 */
export function withAuth(
  state: AuthState,
  children: ReactNode,
  handlers: { signOut?: () => Promise<void>; refresh?: () => Promise<void> } = {},
) {
  const value = {
    state,
    signOut: handlers.signOut ?? (() => Promise.resolve()),
    refresh: handlers.refresh ?? (() => Promise.resolve()),
  };
  return <AuthContext value={value}>{children}</AuthContext>;
}

/** A session object shaped enough for the guards, which only read `user.id`. */
export function fakeSession(userId = '00000000-0000-0000-0000-000000000001') {
  return { user: { id: userId } } as unknown as Extract<
    AuthState,
    { status: 'signedIn' }
  >['session'];
}

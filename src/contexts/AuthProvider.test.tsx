import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { makeProfile } from '@/test/auth-harness';

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

const { getSession, signOut, single, listeners } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  single: vi.fn(),
  listeners: [] as AuthListener[],
}));

vi.mock('@/lib/supabase', () => ({
  AUTH_STORAGE_KEY: 'sonol-auth',
  supabase: {
    auth: {
      getSession,
      signOut,
      onAuthStateChange: (listener: AuthListener) => {
        listeners.push(listener);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  },
}));

vi.mock('@/lib/offline-queue', () => ({ offlineQueue: { clear: vi.fn() } }));

import { AuthProvider } from './AuthProvider';
import { useAuth } from './auth-context';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const SESSION = {
  access_token: 'access',
  refresh_token: 'refresh',
  // Long expired: this is the morning start, an hour or more after the last
  // refresh.
  expires_at: 1,
  user: { id: USER_ID },
} as unknown as Session;

/** What supabase-js answers when the refresh could not reach the server. */
const NETWORK_FAILURE = {
  data: { session: null },
  error: Object.assign(new Error('Load failed'), { name: 'AuthRetryableFetchError' }),
};

function Probe() {
  const { state, signOut: doSignOut } = useAuth();
  return (
    <div>
      <p data-testid="status">{state.status}</p>
      {state.status === 'signedIn' ? <p data-testid="name">{state.profile.display_name}</p> : null}
      <button
        type="button"
        onClick={() => {
          void doSignOut();
        }}
      >
        out
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

/** Fire an auth event the way supabase-js would, and let the deferred handler run. */
async function emit(event: AuthChangeEvent, session: Session | null) {
  await act(async () => {
    for (const listener of listeners) listener(event, session);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const status = () => screen.getByTestId('status').textContent;

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    listeners.length = 0;
    getSession.mockReset();
    signOut.mockReset();
    single.mockReset();
    signOut.mockResolvedValue({ error: null });
  });

  it('keeps the worker signed in when the morning refresh fails on the network', async () => {
    // The regression: the stored session is valid, the refresh just could not
    // get out. This used to land on the sign-in screen.
    localStorage.setItem('sonol-auth', JSON.stringify(SESSION));
    localStorage.setItem('sonol-profile', JSON.stringify(makeProfile({ display_name: 'דנה' })));
    getSession.mockResolvedValue(NETWORK_FAILURE);
    single.mockRejectedValue(new TypeError('Failed to fetch'));

    renderProvider();
    // supabase-js also reports INITIAL_SESSION as null in this situation.
    await emit('INITIAL_SESSION', null);

    await waitFor(() => {
      expect(status()).toBe('signedIn');
    });
    expect(screen.getByTestId('name')).toHaveTextContent('דנה');
  });

  it('opens at once from storage instead of waiting out the refresh retries', () => {
    // On a dead connection supabase-js retries the refresh for up to ~30 s
    // before getSession() answers. The worker must not wait for that.
    localStorage.setItem('sonol-auth', JSON.stringify(SESSION));
    localStorage.setItem('sonol-profile', JSON.stringify(makeProfile({ display_name: 'דנה' })));
    getSession.mockReturnValue(new Promise(() => undefined));

    renderProvider();

    expect(status()).toBe('signedIn');
    expect(screen.getByTestId('name')).toHaveTextContent('דנה');
  });

  it('leaves the optimistic start for sign-in when the server really ended the session', async () => {
    localStorage.setItem('sonol-auth', JSON.stringify(SESSION));
    localStorage.setItem('sonol-profile', JSON.stringify(makeProfile()));
    getSession.mockImplementation(() => {
      // What supabase-js does on a revoked refresh token: delete, then answer.
      localStorage.removeItem('sonol-auth');
      return Promise.resolve({
        data: { session: null },
        error: Object.assign(new Error('Invalid Refresh Token: Revoked'), { name: 'AuthApiError' }),
      });
    });

    renderProvider();

    await waitFor(() => {
      expect(status()).toBe('signedOut');
    });
  });

  it('opens on the stored session even with no cached profile, once the profile loads', async () => {
    localStorage.setItem('sonol-auth', JSON.stringify(SESSION));
    getSession.mockResolvedValue(NETWORK_FAILURE);
    single.mockResolvedValue({ data: makeProfile({ display_name: 'יוסי' }), error: null });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveTextContent('יוסי');
    });
  });

  it('signs out when supabase-js has removed the session — a rejection the server meant', async () => {
    // A revoked or reused refresh token: supabase-js deletes the stored
    // session before answering, so there is nothing to fall back to.
    getSession.mockResolvedValue({
      data: { session: null },
      error: Object.assign(new Error('Invalid Refresh Token: Already Used'), {
        name: 'AuthApiError',
      }),
    });

    renderProvider();

    await waitFor(() => {
      expect(status()).toBe('signedOut');
    });
  });

  it('shows the retry screen when the profile cannot be read and nothing is cached', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    single.mockRejectedValue(new TypeError('Failed to fetch'));

    renderProvider();

    await waitFor(() => {
      expect(status()).toBe('error');
    });
  });

  it('does not drop to an error screen when a refresh event meets a dead connection', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    single.mockResolvedValueOnce({ data: makeProfile({ display_name: 'דנה' }), error: null });

    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveTextContent('דנה');
    });

    // The hourly refresh, or SIGNED_IN on returning from Waze, refetches the
    // profile. On a weak signal that fetch fails; the worker keeps working.
    single.mockRejectedValue(new TypeError('Failed to fetch'));
    await emit('TOKEN_REFRESHED', SESSION);
    await emit('SIGNED_IN', SESSION);

    expect(status()).toBe('signedIn');
    expect(screen.getByTestId('name')).toHaveTextContent('דנה');
  });

  it('signs out on SIGNED_OUT', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    single.mockResolvedValue({ data: makeProfile(), error: null });

    renderProvider();
    await waitFor(() => {
      expect(status()).toBe('signedIn');
    });

    await emit('SIGNED_OUT', null);
    expect(status()).toBe('signedOut');
  });

  it('signs out of this device only, and forgets the cached profile', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    single.mockResolvedValue({ data: makeProfile(), error: null });

    renderProvider();
    await waitFor(() => {
      expect(status()).toBe('signedIn');
    });
    expect(localStorage.getItem('sonol-profile')).not.toBeNull();

    await act(async () => {
      screen.getByRole('button', { name: 'out' }).click();
      await Promise.resolve();
    });

    expect(status()).toBe('signedOut');
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(localStorage.getItem('sonol-profile')).toBeNull();
  });

  it('does not re-cache a profile that arrives after sign-out', async () => {
    getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
    single.mockResolvedValueOnce({ data: makeProfile(), error: null });

    renderProvider();
    await waitFor(() => {
      expect(status()).toBe('signedIn');
    });

    // A refresh event starts a profile fetch; the worker signs out before it
    // answers.
    let answer: (value: unknown) => void = () => undefined;
    single.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    await emit('TOKEN_REFRESHED', SESSION);
    await act(async () => {
      screen.getByRole('button', { name: 'out' }).click();
      await Promise.resolve();
    });
    await act(async () => {
      answer({ data: makeProfile(), error: null });
      await Promise.resolve();
    });

    expect(status()).toBe('signedOut');
    expect(localStorage.getItem('sonol-profile')).toBeNull();
  });

  it('never applies a cached profile that belongs to someone else', async () => {
    localStorage.setItem('sonol-auth', JSON.stringify(SESSION));
    localStorage.setItem(
      'sonol-profile',
      JSON.stringify(makeProfile({ id: 'someone-else', display_name: 'אחר' })),
    );
    getSession.mockResolvedValue(NETWORK_FAILURE);
    single.mockRejectedValue(new TypeError('Failed to fetch'));

    renderProvider();

    await waitFor(() => {
      expect(status()).toBe('error');
    });
  });
});

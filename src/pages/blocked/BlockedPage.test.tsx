import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { BlockedPage } from './BlockedPage';
import { withAuth, makeProfile, fakeSession } from '@/test/auth-harness';
import type { AuthState } from '@/contexts/auth-context';
import { blocked } from '@/lib/copy';

function renderBlocked(state: AuthState, signOut = vi.fn(() => Promise.resolve())) {
  const router = createMemoryRouter(
    [
      { path: '/blocked', element: <BlockedPage /> },
      { path: '/signin', element: <span>SIGNIN</span> },
      { path: '/', element: <span>HOME</span> },
    ],
    { initialEntries: ['/blocked'] },
  );
  render(withAuth(state, <RouterProvider router={router} />, { signOut }));
  return { router, signOut };
}

const unauthorized: AuthState = {
  status: 'signedIn',
  session: fakeSession(),
  profile: makeProfile({ is_authorized: false, is_admin: false }),
};

/**
 * Defect 6: the original lockout screen did not sign the user out and could be
 * escaped with the browser back button.
 */
describe('BlockedPage', () => {
  it('signs the user out on mount — exactly once under StrictMode double-invoke', async () => {
    const { signOut } = renderBlocked(unauthorized);
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  /**
   * The deadlock regression. /blocked is a PUBLIC route precisely so that
   * signing out cannot bounce the user to /signin before they read the
   * message. If someone later moves it behind RequireAuth, this fails.
   */
  it('keeps showing the message after the session is gone', async () => {
    const signOut = vi.fn(() => Promise.resolve());
    const { router } = renderBlocked(unauthorized, signOut);

    expect(screen.getByText(blocked.body)).toBeInTheDocument();
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });

    // Message still on screen, still on /blocked — no redirect happened.
    expect(screen.getByText(blocked.title)).toBeInTheDocument();
    expect(screen.getByText(blocked.body)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/blocked');
  });

  it('does not sign out an authorized user who simply typed the URL', async () => {
    const signOut = vi.fn(() => Promise.resolve());
    const { router } = renderBlocked(
      {
        status: 'signedIn',
        session: fakeSession(),
        profile: makeProfile({ is_authorized: true }),
      },
      signOut,
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it('waits for the auth state before deciding', () => {
    const signOut = vi.fn(() => Promise.resolve());
    renderBlocked({ status: 'loading' }, signOut);
    expect(signOut).not.toHaveBeenCalled();
  });
});

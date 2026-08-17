import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { withAuth, makeProfile, fakeSession } from '@/test/auth-harness';
import type { AuthState } from '@/contexts/auth-context';
import { states } from '@/lib/copy';

function renderAt(state: AuthState, initial = '/') {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [{ path: '/', element: <span>HOME</span> }],
      },
      { path: '/signin', element: <span>SIGNIN</span> },
      { path: '/blocked', element: <span>BLOCKED</span> },
    ],
    { initialEntries: [initial] },
  );
  render(withAuth(state, <RouterProvider router={router} />));
  return router;
}

describe('RequireAuth', () => {
  /**
   * The load-bearing case. If `loading` were treated as "signed out", every
   * page refresh would bounce an already-signed-in user to the login screen
   * before the session was restored from storage.
   */
  it('renders a skeleton while loading and does NOT redirect', () => {
    const router = renderAt({ status: 'loading' });

    expect(screen.getByText(states.loading)).toBeInTheDocument();
    expect(screen.queryByText('SIGNIN')).not.toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('sends a signed-out visitor to sign-in', () => {
    const router = renderAt({ status: 'signedOut' });
    expect(screen.getByText('SIGNIN')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/signin');
  });

  it('lets an authorized worker through', () => {
    renderAt({
      status: 'signedIn',
      session: fakeSession(),
      profile: makeProfile({ is_authorized: true }),
    });
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  it('sends an unauthorized user to the blocked screen', () => {
    const router = renderAt({
      status: 'signedIn',
      session: fakeSession(),
      profile: makeProfile({ is_authorized: false, is_admin: false }),
    });
    expect(screen.getByText('BLOCKED')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/blocked');
  });

  /**
   * `public.is_authorized()` in SQL is `is_authorized OR is_admin`. If the
   * client checked the column alone it would lock an admin out of a UI the
   * database would happily serve.
   */
  it('admits an admin whose is_authorized flag is false, matching the SQL helper', () => {
    renderAt({
      status: 'signedIn',
      session: fakeSession(),
      profile: makeProfile({ is_authorized: false, is_admin: true }),
    });
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  it('offers a retry when the profile could not be read', () => {
    renderAt({ status: 'error', message: 'שגיאה כלשהי' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: states.loadError.retry })).toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });
});

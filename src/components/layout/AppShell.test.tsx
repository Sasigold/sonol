import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './AppShell';
import { withAuth, makeProfile, fakeSession } from '@/test/auth-harness';

/** The shell renders OfflineBanner, which reads the query cache. */
function renderShell(isAdmin = false) {
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <span>HOME</span> },
          { path: '/areas/1', element: <span>AREA</span> },
        ],
      },
    ],
    { initialEntries: ['/'] },
  );

  render(
    <QueryClientProvider client={new QueryClient()}>
      {withAuth(
        { status: 'signedIn', session: fakeSession(), profile: makeProfile({ is_admin: isAdmin }) },
        <RouterProvider router={router} />,
      )}
    </QueryClientProvider>,
  );

  return router;
}

/**
 * The shell is what makes the bottom bar immovable: the page itself does not
 * scroll, `<main>` is the only scroll container, and the bar is simply the last
 * row of a frame one viewport tall. These assertions are on class names, which
 * is normally a smell — but here the class names ARE the behaviour, and jsdom
 * has no layout with which to observe it any other way.
 */
describe('AppShell frame', () => {
  it('clips at one viewport instead of growing with its content', () => {
    renderShell();
    const frame = screen.getByRole('main').parentElement;

    expect(frame).toHaveClass('h-dvh');
    expect(frame).toHaveClass('overflow-hidden');
    // `min-h-dvh` would let the document scroll and take the bar with it.
    expect(frame).not.toHaveClass('min-h-dvh');
  });

  it('makes main the one scroll container', () => {
    renderShell();
    const main = screen.getByRole('main');

    expect(main).toHaveClass('overflow-y-auto');
    // Stops a flick at the top of the list becoming a pull-to-refresh.
    expect(main).toHaveClass('overscroll-contain');
  });

  it('puts the admin nav after main as a non-shrinking row', () => {
    renderShell(true);
    const nav = screen.getByRole('navigation');

    expect(nav).toHaveClass('shrink-0');
    // Nothing is stuck to anything — the frame does not move, so neither can it.
    expect(nav.className).not.toMatch(/\bsticky\b|\bfixed\b/);
    expect(screen.getByRole('main').nextElementSibling).toBe(nav);
  });

  it('returns to the top of the list on navigation', async () => {
    const router = renderShell();
    const main = screen.getByRole('main');

    main.scrollTop = 400;
    // `act`, or the navigation resolves before React has re-rendered and run
    // the layout effect that does the reset.
    await act(async () => {
      await router.navigate('/areas/1');
    });

    expect(screen.getByText('AREA')).toBeInTheDocument();
    expect(main.scrollTop).toBe(0);
  });
});

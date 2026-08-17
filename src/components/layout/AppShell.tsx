import { useLayoutEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { RoleBadge } from '@/components/users/RoleBadge';
import { BottomNav } from './BottomNav';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/hooks/useTheme';
import { actions, app, dialogs, nav } from '@/lib/copy';

/**
 * Header + content frame for every signed-in screen.
 *
 * The sign-out action lives HERE rather than only in the admin bottom
 * navigation (§8.9). As written, the bottom bar is admin-only and holds the
 * only `יציאה` in the app — which would leave a field worker with no way to end
 * their session at all. Admins keep the bottom-nav item too when it arrives.
 *
 * THE PAGE ITSELF DOES NOT SCROLL. The shell is exactly one viewport tall and
 * clips; `<main>` is the only scroll container in the app. That is what makes
 * the bottom bar immovable — it is not stuck to the bottom of anything, it is
 * simply the last row of a frame that never moves. The previous
 * `position: sticky` version measured correctly on desktop, but sticky depends
 * on the document's own scroll, which on a phone is the one thing that is not
 * stable: iOS and Android resize the visual viewport as their toolbars collapse
 * mid-scroll, and a `100dvh` flex column re-lays-out underneath the bar while
 * the finger is still moving. Taking the document out of the scroll entirely
 * removes the class of problem rather than compensating for it.
 */
export function AppShell() {
  const { state, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);

  const profile = state.status === 'signedIn' ? state.profile : null;

  /**
   * Owning the scroll container means owning the scroll reset too.
   *
   * The browser resets the document's scroll on navigation; it knows nothing
   * about ours. Without this, opening an area from halfway down the home list
   * lands you halfway down the station list. Layout effect, not effect — after
   * paint the old offset is visible for a frame.
   *
   * Assigning `scrollTop` rather than calling `scrollTo`: the jump must be
   * instant (a smooth scroll here would animate every navigation), and jsdom
   * implements the property but not the method, so `scrollTo` would throw in
   * every test that renders the shell.
   */
  useLayoutEffect(() => {
    const main = scrollRef.current;
    if (main) main.scrollTop = 0;
  }, [pathname]);

  async function handleSignOut(): Promise<void> {
    setConfirmOpen(false);
    await signOut();
    // Defect 5: the original only navigated, leaving the session alive.
    navigate('/signin', { replace: true });
  }

  return (
    <div className="bg-bg flex h-dvh flex-col overflow-hidden">
      <header className="bg-surface border-border shrink-0 border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 p-4">
          {/*
            The header identity is the entry point to /profile — the bottom nav
            is admin-only, so a field worker needs a route to their own screen
            that does not depend on it.
          */}
          <Link to="/profile" className="flex min-w-0 items-center gap-3" aria-label={nav.profile}>
            {profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt=""
                className="size-12 shrink-0 rounded-full object-cover"
              />
            ) : null}
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-h3 text-text truncate">
                {profile?.display_name ?? app.name}
              </span>
              {profile ? <RoleBadge isAdmin={profile.is_admin} className="self-start" /> : null}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={app.toggleTheme}
              title={app.toggleTheme}
            >
              {theme === 'dark' ? (
                <Moon className="size-5" aria-hidden />
              ) : (
                <Sun className="size-5" aria-hidden />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setConfirmOpen(true);
              }}
              aria-label={nav.signOut}
              title={nav.signOut}
            >
              <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
            </Button>
          </div>
        </div>
      </header>

      <OfflineBanner />

      {/*
        The only scroll container in the app. `overscroll-contain` stops a
        flick at the top of the list from turning into a pull-to-refresh or an
        iOS rubber-band of the page behind it.

        The max-width wrapper is INSIDE the scroller, not on it: putting it on
        the scrolling element would inset the scrollbar from the screen edge on
        a desktop browser.
      */}
      <main ref={scrollRef} className="grow overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl p-4">
          <Outlet />
        </div>
      </main>

      {profile?.is_admin ? <BottomNav /> : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={dialogs.signOut.title}
        description={dialogs.signOut.body}
        confirmLabel={nav.signOut}
        cancelLabel={actions.cancel}
        destructive
        onConfirm={() => {
          void handleSignOut();
        }}
      />
    </div>
  );
}

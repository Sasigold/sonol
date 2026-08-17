import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
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
 */
export function AppShell() {
  const { state, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const profile = state.status === 'signedIn' ? state.profile : null;

  async function handleSignOut(): Promise<void> {
    setConfirmOpen(false);
    await signOut();
    // Defect 5: the original only navigated, leaving the session alive.
    navigate('/signin', { replace: true });
  }

  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <header className="bg-surface border-border sticky top-0 z-40 border-b">
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

      <main className="mx-auto w-full max-w-3xl grow p-4">
        <Outlet />
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

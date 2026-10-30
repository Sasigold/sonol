import { NavLink, useNavigate } from 'react-router-dom';
import { BarChart3, Home, LogOut, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useAuth } from '@/contexts/auth-context';
import { actions, dialogs, nav } from '@/lib/copy';
import { cn } from '@/lib/utils';

/**
 * Admin-only bottom navigation (§8.9), safe-area aware.
 *
 * `יציאה` also lives in the AppShell header, where every user can reach it —
 * this bar is admin-only, so relying on it alone would strand field workers
 * with no way to end their session.
 */
export function BottomNav() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleSignOut(): Promise<void> {
    setConfirmOpen(false);
    await signOut();
    navigate('/signin', { replace: true });
  }

  return (
    <>
      <nav
        aria-label={nav.home}
        // No `sticky`, no `fixed`: this is the last row of a shell that is
        // exactly one viewport tall and does not scroll, so it cannot move.
        // `shrink-0` matters — as a flex item it would otherwise be squeezed by
        // a tall content area before the content area started scrolling.
        className="fx-glass border-border relative shrink-0 border-t pt-1 pb-[env(safe-area-inset-bottom)]"
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-(image:--grad-edge)" />
        <ul className="mx-auto flex w-full max-w-3xl items-stretch">
          <NavItem to="/" icon={Home} label={nav.home} end />
          <NavItem to="/dashboard" icon={BarChart3} label={nav.dashboard} />
          {/* The prominent centre action (§8.9). */}
          <li className="flex flex-1 items-start justify-center">
            {/* Lifted half out of the bar, ringed in the page colour so it
                reads as floating over it. */}
            <NavLink
              to="/stations/new"
              aria-label={nav.add}
              className="bg-primary text-primary-foreground shadow-glow ring-bg -mt-4 flex size-12 items-center justify-center rounded-full bg-(image:--grad-primary) ring-4 transition active:scale-95"
            >
              <Plus className="size-6" aria-hidden />
            </NavLink>
          </li>
          <NavItem to="/users" icon={Users} label={nav.users} />
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(true);
              }}
              className="text-text-muted hover:text-text flex min-h-12 w-full flex-col items-center justify-center gap-1 py-1"
            >
              <span className="flex h-8 w-12 items-center justify-center">
                <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
              </span>
              <span className="text-caption">{nav.signOut}</span>
            </button>
          </li>
        </ul>
      </nav>

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
    </>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  end = false,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  end?: boolean;
}) {
  return (
    <li className="flex flex-1">
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            'flex min-h-12 w-full flex-col items-center justify-center gap-1 py-1 transition-colors',
            isActive ? 'text-neon-strong' : 'text-text-muted hover:text-text',
          )
        }
      >
        {({ isActive }) => (
          <>
            {/* The active destination sits in a lit pill — the label and the
                colour change say it too, so the glow is never alone. */}
            <span
              className={cn(
                'flex h-8 w-12 items-center justify-center rounded-full transition',
                isActive && 'bg-neon-bg shadow-glow',
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <span className={cn('text-caption', isActive && 'font-bold')}>{label}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

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
        className="bg-surface border-border shrink-0 border-t pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex w-full max-w-3xl items-stretch">
          <NavItem to="/" icon={Home} label={nav.home} end />
          <NavItem to="/dashboard" icon={BarChart3} label={nav.dashboard} />
          {/* The prominent centre action (§8.9). */}
          <li className="flex flex-1 items-center justify-center">
            <NavLink
              to="/stations/new"
              aria-label={nav.add}
              className="bg-primary text-primary-foreground shadow-raised flex size-12 items-center justify-center rounded-full"
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
              className="text-text-muted hover:text-text flex h-12 w-full flex-col items-center justify-center gap-1"
            >
              <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
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
            'flex h-12 w-full flex-col items-center justify-center gap-1 transition-colors',
            isActive ? 'text-primary' : 'text-text-muted hover:text-text',
          )
        }
      >
        <Icon className="size-5" aria-hidden />
        <span className="text-caption">{label}</span>
      </NavLink>
    </li>
  );
}

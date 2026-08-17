import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Trash2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { RoleBadge } from '@/components/users/RoleBadge';
import { useAuth } from '@/contexts/auth-context';
import { useDeleteUser, useUpdateUser, useUsers, type UserRow } from '@/hooks/useUsers';
import { toHebrewError } from '@/lib/errors';
import { actions, dialogs, fields, nav, states, toasts } from '@/lib/copy';
import { cn } from '@/lib/utils';

type RoleFilter = 'all' | 'admin' | 'worker';
type AuthFilter = 'all' | 'authorized' | 'unauthorized';

export function UsersPage() {
  const { state } = useAuth();
  const navigate = useNavigate();
  const { data: users, isPending, isError, refetch } = useUsers();
  const deleteUser = useDeleteUser();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [authorized, setAuthorized] = useState<AuthFilter>('all');
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);

  const myId = state.status === 'signedIn' ? state.profile.id : '';

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (
      (users ?? [])
        // Never list yourself (§8.8).
        .filter((user) => user.id !== myId)
        .filter((user) =>
          term.length === 0
            ? true
            : user.display_name.toLowerCase().includes(term) ||
              user.email.toLowerCase().includes(term),
        )
        .filter((user) =>
          role === 'all' ? true : role === 'admin' ? user.is_admin : !user.is_admin,
        )
        .filter((user) =>
          authorized === 'all'
            ? true
            : authorized === 'authorized'
              ? user.is_authorized
              : !user.is_authorized,
        )
    );
  }, [users, myId, search, role, authorized]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h1 text-text">{nav.users}</h1>
        <Button
          onClick={() => {
            navigate('/users/new');
          }}
        >
          <UserPlus className="size-5" aria-hidden />
          {nav.newUser}
        </Button>
      </div>

      <div className="relative flex items-center">
        <Search
          className="text-text-muted pointer-events-none absolute start-4 size-5"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          aria-label={actions.search}
          placeholder={actions.search}
          className="ps-12"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterGroup
          value={role}
          onChange={setRole}
          options={[
            { value: 'all', label: actions.filterAll },
            { value: 'admin', label: fields.admin },
            { value: 'worker', label: fields.worker },
          ]}
        />
        <FilterGroup
          value={authorized}
          onChange={setAuthorized}
          options={[
            { value: 'all', label: actions.filterAll },
            { value: 'authorized', label: fields.authorized },
            { value: 'unauthorized', label: actions.filterUnauthorized },
          ]}
        />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <span className="sr-only">{states.loading}</span>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {users ? (
        rows.length === 0 ? (
          <EmptyState icon={Users} title={states.noUsersFound} />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((user) => (
              <li key={user.id}>
                <UserCard
                  user={user}
                  onOpen={() => {
                    navigate(`/users/${user.id}/edit`);
                  }}
                  onDelete={() => {
                    setPendingDelete(user);
                  }}
                />
              </li>
            ))}
          </ul>
        )
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={dialogs.deleteUser.title}
        description={dialogs.deleteUser.body(pendingDelete?.display_name ?? '')}
        destructive
        pending={deleteUser.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteUser.mutate(pendingDelete.id, {
            onSuccess: () => {
              setPendingDelete(null);
              toast.success(toasts.userDeleted);
            },
            onError: (error) => {
              setPendingDelete(null);
              toast.error(toHebrewError(error));
            },
          });
        }}
      />
    </div>
  );
}

function UserCard({
  user,
  onOpen,
  onDelete,
}: {
  user: UserRow;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const update = useUpdateUser(user.id);
  const initials = user.display_name.trim().charAt(0) || '?';

  return (
    <div className="bg-surface border-border shadow-card flex items-center gap-3 rounded-lg border p-4">
      {/*
        The whole row opens the edit screen — for EVERY user, authorised or
        not. In the original an unauthorised user had no entry point at all,
        so there was no way to authorise them.
      */}
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="bg-brand-100 text-brand-800 text-body-strong flex size-12 shrink-0 items-center justify-center rounded-full">
          {initials}
        </span>
        <span className="flex min-w-0 flex-col items-start gap-1">
          {/* Defect 14: names were truncated to a single character in the list. */}
          <span className="text-body-strong text-text truncate">{user.display_name}</span>
          <span className="text-caption text-text-muted ltr-isolate truncate">{user.email}</span>
          <span className="flex items-center gap-2">
            <RoleBadge isAdmin={user.is_admin} />
            <span className="text-caption text-text-muted">
              {fields.area} {user.area_ids.length}
            </span>
          </span>
        </span>
      </button>

      <div className="flex shrink-0 flex-col items-center gap-2">
        <label className="flex flex-col items-center gap-1">
          <span className="text-caption text-text-muted">{fields.authorized}</span>
          <Switch
            checked={user.is_authorized}
            disabled={update.isPending}
            onCheckedChange={(checked) => {
              update.mutate(
                { isAuthorized: checked },
                {
                  onSuccess: () => {
                    toast.success(toasts.permissionsUpdated);
                  },
                  onError: (error) => {
                    toast.error(toHebrewError(error));
                  },
                },
              );
            }}
          />
        </label>

        <Button variant="ghost" size="icon" onClick={onDelete} aria-label={actions.delete}>
          <Trash2 className="text-danger size-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="bg-surface-alt flex gap-1 rounded-full p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            onChange(option.value);
          }}
          aria-pressed={value === option.value}
          className={cn(
            'text-caption h-12 rounded-full px-4 transition-colors',
            value === option.value ? 'bg-surface text-text shadow-card' : 'text-text-muted',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

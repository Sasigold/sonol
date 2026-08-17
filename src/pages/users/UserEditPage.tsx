import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { AreaChips } from '@/components/users/AreaChips';
import { useAuth } from '@/contexts/auth-context';
import { useAllAreas, type Area } from '@/hooks/useAreas';
import { useUpdateUser, useUser, type UserRow } from '@/hooks/useUsers';
import { toHebrewError } from '@/lib/errors';
import { actions, app, fields, nav, states, toasts } from '@/lib/copy';

export function UserEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const userQuery = useUser(id);
  const areasQuery = useAllAreas();

  const isPending = userQuery.isPending || areasQuery.isPending;
  const isError = userQuery.isError || areasQuery.isError;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            navigate('/users');
          }}
          aria-label={nav.back}
        >
          <ArrowRight className="size-5" aria-hidden />
        </Button>
        <h1 className="text-h1 text-text">{nav.editUser}</h1>
      </header>

      {isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <span className="sr-only">{states.loading}</span>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          onRetry={() => {
            void userQuery.refetch();
            void areasQuery.refetch();
          }}
        />
      ) : null}

      {!isPending && !isError ? (
        // `key` remounts the form when a different user is loaded, so its state
        // is seeded from props at construction. Seeding in an effect instead
        // would cascade renders — and React's own guidance is to reset state
        // with a key rather than synchronise it in an effect.
        <UserEditForm key={userQuery.data.id} user={userQuery.data} areas={areasQuery.data} />
      ) : null}
    </div>
  );
}

function UserEditForm({ user, areas }: { user: UserRow; areas: Area[] }) {
  const navigate = useNavigate();
  const { state } = useAuth();
  const update = useUpdateUser(user.id);

  /**
   * Defect 2 — the worst bug in the original app.
   *
   * The "authorized?" switch on this screen was bound to the SIGNED-IN
   * ADMIN'S record instead of the user being edited, so saving overwrote the
   * target's permission with the admin's own.
   *
   * Every initial value below comes from `user` — the entity being edited.
   * The only thing read from the current session is the self-demotion check,
   * which is the one place the signed-in user genuinely is the subject.
   */
  const [isAuthorized, setIsAuthorized] = useState(user.is_authorized);
  const [isAdmin, setIsAdmin] = useState(user.is_admin);
  const [areaIds, setAreaIds] = useState<string[]>(user.area_ids);

  const editingSelf = state.status === 'signedIn' && state.profile.id === user.id;

  function save() {
    update.mutate(
      {
        isAuthorized,
        // The RPC refuses self-demotion; omitting it means the UI never asks
        // for something the server is going to reject.
        ...(editingSelf ? {} : { isAdmin }),
        areaIds,
      },
      {
        onSuccess: () => {
          toast.success(toasts.userUpdated);
          navigate('/users', { replace: true });
        },
        onError: (error) => {
          toast.error(toHebrewError(error));
        },
      },
    );
  }

  return (
    <>
      {/* Name and email are read-only, with the explanatory note §8.8 asks for. */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="display_name">{fields.fullName}</Label>
        <Input id="display_name" value={user.display_name} readOnly disabled />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{fields.email}</Label>
        <Input id="email" value={user.email} readOnly disabled dir="ltr" className="text-start" />
        <p className="text-caption text-text-muted">{app.readOnlyNote}</p>
      </div>

      <div className="border-border flex items-center justify-between gap-4 rounded-md border p-4">
        <Label htmlFor="is_authorized">{fields.authorized}</Label>
        <Switch id="is_authorized" checked={isAuthorized} onCheckedChange={setIsAuthorized} />
      </div>

      <div className="border-border flex items-center justify-between gap-4 rounded-md border p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="is_admin">{fields.admin}</Label>
          {editingSelf ? (
            <p className="text-caption text-text-muted">{app.cannotDemoteSelf}</p>
          ) : null}
        </div>
        <Switch
          id="is_admin"
          checked={isAdmin}
          disabled={editingSelf}
          onCheckedChange={setIsAdmin}
          title={editingSelf ? app.cannotDemoteSelf : undefined}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Label>{fields.area}</Label>
        <AreaChips areas={areas} selected={areaIds} onChange={setAreaIds} />
      </div>

      <Button size="wide" onClick={save} disabled={update.isPending}>
        {update.isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        {actions.save}
      </Button>
    </>
  );
}

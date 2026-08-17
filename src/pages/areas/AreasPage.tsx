import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPinned,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  useAllAreas,
  useCreateArea,
  useDeleteArea,
  useRenameArea,
  useSwapAreaOrder,
  type Area,
} from '@/hooks/useAreas';
import { useAreaStats } from '@/hooks/useDashboard';
import { toHebrewError } from '@/lib/errors';
import { areaSchema, type AreaValues } from '@/lib/schemas';
import { actions, areas as copy, dialogs, fields, labels, nav, states, toasts } from '@/lib/copy';

/**
 * Area management — the CRUD the app never had.
 *
 * Areas gate everything: which stations a worker can reach, what a station can
 * belong to, and the order the home screen lists them in. Until this screen
 * existed the only way to add one was an `insert` typed into the Supabase SQL
 * editor, which the README documented as a setup step.
 */
export function AreasPage() {
  const navigate = useNavigate();
  const areasQuery = useAllAreas();
  const statsQuery = useAreaStats();

  const create = useCreateArea();
  const rename = useRenameArea();
  const swap = useSwapAreaOrder();
  const remove = useDeleteArea();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Area | null>(null);

  const isPending = areasQuery.isPending || statsQuery.isPending;
  const isError = areasQuery.isError || statsQuery.isError;
  const list = areasQuery.data ?? [];

  /** Stations per area, from the view — never counted on the client. */
  function stationCount(areaId: string): number {
    return statsQuery.data?.find((row) => row.area_id === areaId)?.station_count ?? 0;
  }

  function move(index: number, direction: -1 | 1) {
    const current = list[index];
    const neighbour = list[index + direction];
    // `noUncheckedIndexedAccess` makes both possibly-undefined, which is also
    // the real guard: the first row cannot move up and the last cannot move
    // down.
    if (!current || !neighbour) return;

    swap.mutate(
      { a: current, b: neighbour },
      {
        onError: (error) => {
          toast.error(toHebrewError(error));
        },
      },
    );
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    remove.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(null);
        toast.success(toasts.areaDeleted);
      },
      onError: (error) => {
        setPendingDelete(null);
        toast.error(toHebrewError(error));
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              navigate('/dashboard');
            }}
            aria-label={nav.back}
          >
            {/* "Back" in RTL points right. */}
            <ArrowRight className="size-5" aria-hidden />
          </Button>
          <h1 className="text-h1 text-text truncate">{nav.areas}</h1>
        </div>

        <Button
          onClick={() => {
            setAdding(true);
            setEditingId(null);
          }}
          disabled={adding}
        >
          <Plus className="size-5" aria-hidden />
          {actions.addArea}
        </Button>
      </header>

      <p className="text-small text-text-muted">{copy.intro}</p>

      {adding ? (
        <AreaForm
          title={nav.newArea}
          submitLabel={actions.add}
          pending={create.isPending}
          onCancel={() => {
            setAdding(false);
          }}
          onSubmit={(values) => {
            create.mutate(
              { ...values, existing: list },
              {
                onSuccess: () => {
                  setAdding(false);
                  toast.success(toasts.areaAdded);
                },
                onError: (error) => {
                  toast.error(toHebrewError(error));
                },
              },
            );
          }}
        />
      ) : null}

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
            void areasQuery.refetch();
            void statsQuery.refetch();
          }}
        />
      ) : null}

      {!isPending && !isError ? (
        list.length === 0 ? (
          <EmptyState
            icon={MapPinned}
            title={states.noAreas.title}
            description={states.noAreas.body}
            action={
              <Button
                onClick={() => {
                  setAdding(true);
                }}
              >
                {actions.addArea}
              </Button>
            }
          />
        ) : (
          <>
            <p className="text-caption text-text-muted">{copy.orderHint}</p>
            <ul className="flex flex-col gap-3">
              {list.map((area, index) => (
                <li key={area.id}>
                  {editingId === area.id ? (
                    <AreaForm
                      title={nav.editArea}
                      submitLabel={actions.save}
                      defaultName={area.name}
                      pending={rename.isPending}
                      onCancel={() => {
                        setEditingId(null);
                      }}
                      onSubmit={(values) => {
                        rename.mutate(
                          { id: area.id, ...values },
                          {
                            onSuccess: () => {
                              setEditingId(null);
                              toast.success(toasts.areaUpdated);
                            },
                            onError: (error) => {
                              toast.error(toHebrewError(error));
                            },
                          },
                        );
                      }}
                    />
                  ) : (
                    <div className="bg-surface border-border shadow-card flex items-center gap-3 rounded-lg border p-4">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-body-strong text-text truncate">{area.name}</span>
                        <span className="text-caption text-text-muted">
                          {labels.stationsInArea(stationCount(area.id))}
                        </span>
                      </div>

                      {/* Vertical arrows — nothing to mirror in RTL. */}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={actions.moveUp}
                        disabled={index === 0 || swap.isPending}
                        onClick={() => {
                          move(index, -1);
                        }}
                      >
                        <ChevronUp className="size-5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={actions.moveDown}
                        disabled={index === list.length - 1 || swap.isPending}
                        onClick={() => {
                          move(index, 1);
                        }}
                      >
                        <ChevronDown className="size-5" aria-hidden />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={actions.rename}
                        onClick={() => {
                          setEditingId(area.id);
                          setAdding(false);
                        }}
                      >
                        <Pencil className="size-5" aria-hidden />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={actions.delete}
                        onClick={() => {
                          const count = stationCount(area.id);
                          // The FK is `on delete restrict`, so this would fail
                          // anyway — saying how many stations are in the way is
                          // a better answer than a refused write.
                          if (count > 0) {
                            toast.error(dialogs.deleteArea.hasStations(count));
                            return;
                          }
                          setPendingDelete(area);
                        }}
                      >
                        <Trash2 className="text-danger size-5" aria-hidden />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={dialogs.deleteArea.title}
        description={dialogs.deleteArea.body(pendingDelete?.name ?? '')}
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/** Add and rename share one form — the only field either has is the name. */
function AreaForm({
  title,
  submitLabel,
  defaultName = '',
  pending,
  onSubmit,
  onCancel,
}: {
  title: string;
  submitLabel: string;
  defaultName?: string;
  pending: boolean;
  onSubmit: (values: AreaValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AreaValues>({
    resolver: zodResolver(areaSchema),
    defaultValues: { name: defaultName },
  });

  return (
    <form
      noValidate
      className="bg-surface border-border shadow-card flex flex-col gap-3 rounded-lg border p-4"
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
    >
      <h2 className="text-h3 text-text">{title}</h2>

      <div className="flex flex-col gap-2">
        <Label htmlFor="area-name">{fields.areaName}</Label>
        <Input
          id="area-name"
          autoFocus
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          {...register('name')}
        />
        {errors.name ? (
          <p role="alert" className="text-small text-danger">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {actions.cancel}
        </Button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { StationForm } from '@/components/stations/StationForm';
import { useAllAreas } from '@/hooks/useAreas';
import { useStation } from '@/hooks/useStations';
import { useCreateStation, useDeleteStation, useUpdateStation } from '@/hooks/useStationMutations';
import { toHebrewError } from '@/lib/errors';
import type { StationValues } from '@/lib/schemas';
import { dialogs, nav, states, toasts } from '@/lib/copy';

export function StationFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const areasQuery = useAllAreas();
  const stationQuery = useStation(mode === 'edit' ? id : undefined);

  const create = useCreateStation();
  const update = useUpdateStation(id ?? '');
  const remove = useDeleteStation();

  const [confirmDelete, setConfirmDelete] = useState(false);

  const station = stationQuery.data;
  const isPending = areasQuery.isPending || (mode === 'edit' && stationQuery.isPending);
  const isError = areasQuery.isError || (mode === 'edit' && stationQuery.isError);

  function handleSubmit(values: StationValues) {
    const mutation = mode === 'create' ? create : update;
    mutation.mutate(values, {
      onSuccess: () => {
        toast.success(mode === 'create' ? toasts.stationAdded : toasts.stationUpdated);
        navigate(`/areas/${values.area_id}`, { replace: true });
      },
      onError: (error) => {
        toast.error(toHebrewError(error));
      },
    });
  }

  function handleDelete() {
    if (!id || !station) return;
    remove.mutate(id, {
      onSuccess: () => {
        toast.success(toasts.stationDeleted);
        // Navigate AWAY immediately. Defect 12: the original deleted with no
        // confirmation and left the page subscribed to a deleted row, which
        // then crashed.
        navigate(`/areas/${station.area_id}`, { replace: true });
      },
      onError: (error) => {
        setConfirmDelete(false);
        toast.error(toHebrewError(error));
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            navigate(-1);
          }}
          aria-label={nav.back}
        >
          <ArrowRight className="size-5" aria-hidden />
        </Button>
        <h1 className="text-h1 text-text">
          {mode === 'create' ? nav.addStation : nav.editStation}
        </h1>
      </header>

      {isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <span className="sr-only">{states.loading}</span>
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <ErrorState
          onRetry={() => {
            void areasQuery.refetch();
            void stationQuery.refetch();
          }}
        />
      ) : null}

      {!isPending && !isError ? (
        <StationForm
          areas={areasQuery.data}
          station={station}
          defaultAreaId={searchParams.get('area') ?? undefined}
          pending={create.isPending || update.isPending || remove.isPending}
          onSubmit={handleSubmit}
          onDelete={
            mode === 'edit'
              ? () => {
                  setConfirmDelete(true);
                }
              : undefined
          }
        />
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={dialogs.deleteStation.title}
        description={dialogs.deleteStation.body(station?.name ?? '')}
        destructive
        pending={remove.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
